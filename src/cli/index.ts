#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { Command } from 'commander'
import { Config, ConfigLoadError } from '../config/config.js'
import { globalPaths, localPaths } from '../config/paths.js'
import { Cache } from '../core/cache.js'
import { Engine, type Result } from '../core/engine.js'
import { ParseError, Parser } from '../core/parser.js'
import { buildReport, formatReport } from '../core/perf-report.js'
import { Timer } from '../core/timer.js'
import { RuleRegistry } from '../rules/registry.js'

const program = new Command()

const { version } = createRequire(import.meta.url)('../../package.json')

program.name('guardrail').description('Enforce bounds on AI-generated code').version(version)

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
      const rulesDir = scope === 'global' ? globalPaths(homedir()).rulesDir : localPaths(process.cwd()).rulesDir

      const filePath = join(rulesDir, `${name}.ts`)
      if (existsSync(filePath)) {
        process.stderr.write(`guardrail: rule already exists: ${filePath}\n`)
        process.exit(1)
      }

      mkdirSync(rulesDir, { recursive: true })

      const template = `
export default function(register) {
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
    const cwd = process.cwd()
    const registry = await RuleRegistry.load(cwd, homedir())

    const entries = registry.getEntries()

    for (const { ruleId, definition } of entries) {
      const severity = definition.defaultSeverity ?? 'error'
      console.log(`${ruleId}  (${severity})  ${definition.description}`)
    }
  })
)

program
  .command('check')
  .argument('[files...]', 'Files to check')
  .description('Check files against rules')
  .option('--json', 'Output results as JSON')
  .option('--quiet', 'Only show files with violations')
  .option('--timing', 'Print timing/performance breakdown to stderr')
  .option('--claude-code', 'Claude Code hook mode: reads stdin JSON, outputs violations to stderr, exits 2 on failure')
  .action(async (files: string[], options: { json: boolean; quiet: boolean; timing: boolean; claudeCode: boolean }) => {
    let engine: Engine
    let timer: Timer | undefined
    try {
      const cwd = process.cwd()
      const homeDir = homedir()

      if (options.timing) {
        timer = new Timer()
        const registry = await timer.measureAsync('registry.load', () => RuleRegistry.load(cwd, homeDir))
        const config = await timer.measureAsync('config.load', () => Config.load(cwd, homeDir))
        const parser = await timer.measureAsync('parser.load', () => Parser.load())
        const cache = await timer.measureAsync('cache.load', () => Cache.load(cwd, homeDir))

        validateKnownRules(config, registry)

        engine = new Engine(parser, config, cache, registry)
        engine.setTimer(timer)
      } else {
        const registry = await RuleRegistry.load(cwd, homeDir)
        const config = await Config.load(cwd, homeDir)
        const parser = await Parser.load()
        const cache = await Cache.load(cwd, homeDir)

        validateKnownRules(config, registry)

        engine = new Engine(parser, config, cache, registry)
      }
    } catch (err) {
      if (err instanceof ConfigLoadError) {
        process.stderr.write(`guardrail: ${err.message}\n`)
        process.exit(1)
      }
      throw err
    }

    if (options.claudeCode) {
      await runClaudeCodeHook(engine)
      process.exit(0)
    }

    const results = await engine.check(files.length === 0 ? ['.'] : files)
    outputResults(results, options)

    if (options.timing && timer) {
      const report = buildReport(timer.getMetrics())
      process.stderr.write(`\n${formatReport(report)}\n`)
    }

    process.exit(results.some((r) => !r.passed) ? 1 : 0)
  })

program
  .command('config')
  .description('Print configuration (global, local, merged)')
  .action(async () => {
    try {
      const config = await Config.load(process.cwd(), homedir())

      console.log(JSON.stringify(config.toJson(), null, 2))
    } catch (err) {
      if (err instanceof ConfigLoadError) {
        process.stderr.write(`guardrail: ${err.message}\n`)
        process.exit(1)
      }
      throw err
    }
  })

program.parse()

async function runClaudeCodeHook(engine: Engine): Promise<never> {
  const input = await readStdin()
  let filePath: string | undefined
  try {
    filePath = JSON.parse(input)?.tool_input?.file_path
  } catch {
    process.exit(0)
  }
  if (!filePath) process.exit(0)

  let _source: string
  try {
    _source = readFileSync(filePath, 'utf-8')
  } catch (err) {
    process.stderr.write(`guardrail: cannot read ${filePath}: ${(err as Error).message}\n`)
    process.exit(2)
  }

  try {
    const result = await engine.check([filePath])
    if (result.every((r) => r.passed)) {
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

function outputResults(results: Result[], options: { json: boolean; quiet: boolean }): void {
  if (options.json) {
    console.log(JSON.stringify(results, null, 2))
    return
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

function validateKnownRules(config: Config, ruleRegistry: RuleRegistry): void {
  const knownRuleIds = ruleRegistry.getRuleIds()
  const data = config.toJson()
  const configured = new Set<string>()
  for (const id of Object.keys(data.rules ?? {})) configured.add(id)
  for (const override of Object.values(data.overrides ?? {})) {
    for (const id of Object.keys(override.rules ?? {})) configured.add(id)
  }
  for (const id of configured) {
    if (!knownRuleIds.has(id)) {
      process.stderr.write(`guardrail: unknown rule "${id}"\n`)
    }
  }
}
