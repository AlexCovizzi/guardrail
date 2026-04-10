#!/usr/bin/env node

import { Command } from 'commander'
import { Engine } from '../core/engine.js'
import { loadConfig } from '../config/resolver.js'
import { readFileSync } from 'fs'

const program = new Command()

program.name('guardrail').description('Enforce bounds on AI-generated code').version('0.1.0')

program
  .command('check <files...>')
  .description('Check files against rules')
  .option('--format <format>', 'Output format: text or json', 'text')
  .action(async (files: string[], options: { format: string }) => {
    const config = loadConfig()
    const engine = new Engine(config)

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
