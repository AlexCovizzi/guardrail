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
  .action(async (files: string[]) => {
    const config = loadConfig()
    const engine = new Engine(config)

    let failed = false

    for (const file of files) {
      const source = readFileSync(file, 'utf-8')
      const result = await engine.check(file, source)

      console.log(`${result.passed ? '✓' : '✗'} ${file}`)

      for (const v of result.violations) {
        console.log(`  ${v.severity}: ${v.message} (${v.location.start.line}:${v.location.start.column})`)
        failed = true
      }
    }

    process.exit(failed ? 1 : 0)
  })

program.parse()
