#!/usr/bin/env node

import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Command } from 'commander'
import { globSync } from 'tinyglobby'
import { Config, ConfigLoadError } from '../config/config.js'
import { GLOBAL_RULES_DIR } from '../config/paths.js'
import { Engine } from '../core/engine.js'
import { ParseError } from '../core/parser.js'
import { registerBuiltins } from '../rules/builtin/index.js'
import { discoverRules } from '../rules/discovery.js'
import { RuleRegistry } from '../rules/registry.js'

const SUPPORTED_EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'kt', 'kts']

const program = new Command()

program.name('guardrail').description('Enforce bounds on AI-generated code').version('1.0.0')

const ruleCommand = program.command('rule').description('Rule management commands')

ruleCommand.addCommand(
  new Command('add')
    .argument('<name>', 'Rule name (kebab-case)')
    .description('Scaffold a new custom rule')
    .option('--scope <scope>', 'Where to add the rule: local or global', 'global')
    .action((name: string, options: { scope: string }) => {
      if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
        process.stderr.write(`guardrail: rule name must be kebab-case (e.g. my-rule, no-console)\n`)
        process.exit(1)
      }

      const scope = options.scope === 'global' ? 'global' : 'local'
      const rulesDir = scope === 'global' ? GLOBAL_RULES_DIR : join(process.cwd(), '.guardrail', 'rules')

      const filePath = join(rulesDir, `${name}.ts`)
      if (existsSync(filePath)) {
        process.stderr.write(`guardrail: rule already exists: ${filePath}\n`)
        process.exit(1)
      }

      mkdirSync(rulesDir, { recursive: true })

      const template = `import type { RegisterFn } from '@alexcvzz/guardrail'

export default function(register: RegisterFn) {
  register('${name}', {
    description: '',
    defaultSeverity: 'error',
    create(config) {
      return {
        function(node, ctx, report) {
          // your logic here
        },
      }
    },
  })
}
`
      writeFileSync(filePath, template)
      console.log(`Created ${filePath}`)
    })
)

ruleCommand.addCommand(
  new Command('list').description('List all available rules').action(async () => {
    const registry = new RuleRegistry()
    const register = registry.register.bind(registry)
    registerBuiltins(register)
    await discoverRules(register)

    const entries = registry.getEntries()
    const builtinIds = new Set<string>()

    registerBuiltins((id: string) => builtinIds.add(id))

    for (const { ruleId, definition } of entries) {
      const source = builtinIds.has(ruleId) ? 'builtin' : 'custom'
      const severity = definition.defaultSeverity ?? 'error'
      console.log(`${ruleId}  (${source}, ${severity})  ${definition.description}`)
    }
  })
)

program
  .command('check')
  .argument('[files...]', 'Files to check')
  .description('Check files against rules')
  .option('--json', 'Output results as JSON')
  .option('--quiet', 'Only show files with violations')
  .option('--claude-code', 'Claude Code hook mode: reads stdin JSON, outputs violations to stderr, exits 2 on failure')
  .action(async (files: string[], options: { json: boolean; quiet: boolean; claudeCode: boolean }) => {
    let engine: Engine
    try {
      engine = await Engine.create()
    } catch (err) {
      if (err instanceof ConfigLoadError) {
        process.stderr.write(`guardrail: ${err.message}\n`)
        process.exit(1)
      }
      throw err
    }

    if (options.claudeCode) {
      const input = await readStdin()
      let filePath: string | undefined
      try {
        filePath = JSON.parse(input)?.tool_input?.file_path
      } catch {
        process.exit(0)
      }
      if (!filePath) process.exit(0)

      let source: string
      try {
        source = readFileSync(filePath, 'utf-8')
      } catch (err) {
        process.stderr.write(`guardrail: cannot read ${filePath}: ${(err as Error).message}\n`)
        process.exit(2)
      }

      try {
        const result = await engine.check(filePath, source)
        if (!result.passed) {
          process.stderr.write(`${JSON.stringify(result)}\n`)
          process.exit(2)
        }
      } catch (err) {
        if (err instanceof ParseError) {
          process.stderr.write(`guardrail: ${err.message}\n`)
          process.exit(2)
        }
        throw err
      }
      process.exit(0)
    }

    const expanded = expandInputs(files.length === 0 ? ['.'] : files, engine.getIgnorePatterns())

    const results = []
    for (const file of expanded) {
      let source: string
      try {
        source = readFileSync(file, 'utf-8')
      } catch (err) {
        process.stderr.write(`guardrail: cannot read ${file}: ${(err as Error).message}\n`)
        continue
      }

      try {
        results.push(await engine.check(file, source))
      } catch (err) {
        if (err instanceof ParseError) {
          process.stderr.write(`guardrail: ${err.message}\n`)
          continue
        }
        throw err
      }
    }

    const hasErrors = results.some((r) => !r.passed)

    if (options.json) {
      console.log(JSON.stringify(results, null, 2))
      process.exit(hasErrors ? 1 : 0)
    }

    for (const result of results) {
      if (options.quiet && result.violations.length === 0) continue
      console.log(`${result.passed ? '✓' : '✗'} ${result.filename}`)
      for (const v of result.violations) {
        console.log(`  ${v.severity}: ${v.message} [${v.ruleId}] (${v.location.start.line}:${v.location.start.column})`)
      }
    }

    const errors = results.reduce((sum, r) => sum + r.violations.filter((v) => v.severity === 'error').length, 0)
    const warnings = results.reduce((sum, r) => sum + r.violations.filter((v) => v.severity === 'warning').length, 0)
    console.log(`\n${results.length} file(s), ${errors} error(s), ${warnings} warning(s)`)

    process.exit(hasErrors ? 1 : 0)
  })

program
  .command('config')
  .description('Print configuration (global, local, merged)')
  .action(async () => {
    let raw: Awaited<ReturnType<typeof Config.loadData>>
    try {
      raw = Config.loadData()
    } catch (err) {
      if (err instanceof ConfigLoadError) {
        process.stderr.write(`guardrail: ${err.message}\n`)
        process.exit(1)
      }
      throw err
    }

    const localPath = Config.getLocalConfigPath(process.cwd())

    console.log(`# Global: ${Config.getGlobalConfigPath()}`)
    console.log(stringifyConfig(raw.global))
    console.log(`# Local: ${localPath ?? '(none found)'}`)
    console.log(stringifyConfig(raw.local))
    console.log('# Merged')
    console.log(stringifyConfig(raw.merged))
  })

program.parse()

function stringifyConfig(data: object): string {
  return JSON.stringify(data, null, 2)
}

function expandInputs(inputs: string[], ignorePatterns: string[]): string[] {
  const result: string[] = []
  for (const input of inputs) {
    if (existsSync(input) && lstatSync(input).isDirectory()) {
      const pattern = `${input}/**/*.{${SUPPORTED_EXTENSIONS.join(',')}}`
      result.push(...globSync(pattern, { onlyFiles: true, ignore: ignorePatterns }))
    } else {
      const matches = globSync(input, { onlyFiles: true, ignore: ignorePatterns })
      result.push(...(matches.length > 0 ? matches : [input]))
    }
  }
  return result.filter((f) => existsSync(f))
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', (chunk) => (data += chunk))
    process.stdin.on('end', () => resolve(data))
    if (process.stdin.isTTY) resolve('')
  })
}
