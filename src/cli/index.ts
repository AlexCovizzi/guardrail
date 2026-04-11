#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { Command } from 'commander'
import { Engine } from '../core/engine.js'

const program = new Command()

program.name('guardrail').description('Enforce bounds on AI-generated code').version('0.1.0')

program
  .command('check')
  .argument('[files...]', 'Files to check')
  .description('Check files against rules')
  .option('--format <format>', 'Output format: text or json', 'text')
  .option('--claude-code', 'Claude Code hook mode: reads stdin JSON, outputs violations to stderr, exits 2 on failure')
  .action(async (files: string[], options: { format: string; claudeCode: boolean }) => {
    const engine = await Engine.create()

    if (options.claudeCode) {
      const input = await readStdin()
      const filePath: string | undefined = JSON.parse(input)?.tool_input?.file_path
      if (!filePath) process.exit(0)

      const source = readFileSync(filePath, 'utf-8')
      const result = await engine.check(filePath, source)
      if (!result.passed) {
        process.stderr.write(`${JSON.stringify(result)}\n`)
        process.exit(2)
      }
      process.exit(0)
    }

    const results = []
    for (const file of files) {
      const source = readFileSync(file, 'utf-8')
      results.push(await engine.check(file, source))
    }

    if (options.format === 'json') {
      console.log(JSON.stringify(results, null, 2))
      process.exit(results.some((r) => !r.passed) ? 1 : 0)
    }

    let failed = false
    for (const result of results) {
      console.log(`${result.passed ? '✓' : '✗'} ${result.filename}`)
      for (const v of result.violations) {
        console.log(`  ${v.severity}: ${v.message} (${v.location.start.line}:${v.location.start.column})`)
        if (v.hint) console.log(`  hint: ${v.hint}`)
        failed = true
      }
    }

    process.exit(failed ? 1 : 0)
  })

program.parse()

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', (chunk) => (data += chunk))
    process.stdin.on('end', () => resolve(data))
    if (process.stdin.isTTY) resolve('')
  })
}
