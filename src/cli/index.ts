#!/usr/bin/env node

import { existsSync, lstatSync, readFileSync } from 'node:fs'
import { globSync } from 'tinyglobby'
import { Command } from 'commander'
import { Engine } from '../core/engine.js'
import { ParseError } from '../core/parser.js'
import { ConfigLoadError } from '../config/config.js'

const SUPPORTED_EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'kt', 'kts']

const program = new Command()

program.name('guardrail').description('Enforce bounds on AI-generated code').version('0.1.0')

program
  .command('check')
  .argument('[files...]', 'Files to check')
  .description('Check files against rules')
  .option('--format <format>', 'Output format: text or json', 'text')
  .option('--quiet', 'Only show files with violations')
  .option('--claude-code', 'Claude Code hook mode: reads stdin JSON, outputs violations to stderr, exits 2 on failure')
  .action(async (files: string[], options: { format: string; quiet: boolean; claudeCode: boolean }) => {
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

    const expanded = expandInputs(files, engine.getIgnorePatterns())

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

    if (options.format === 'json') {
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

program.parse()

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
