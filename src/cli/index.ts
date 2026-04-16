#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createCommand } from 'commander'
import { claudeCommand } from './claude.js'
import { ConfigLoadError } from '../config/config.js'
import { Guardrail } from '../core/guardrail.js'
import { Env } from '../core/env.js'
import { buildReport, formatReport } from '../core/timing-report.js'
import type { Result } from '../core/engine.js'

const { version } = createRequire(import.meta.url)('../../package.json')

createCommand()
  .name('guardrail')
  .description('Enforce bounds on AI-generated code')
  .version(version)
  .addCommand(
    createCommand('rule')
      .description('Rule management commands')
      .addCommand(
        createCommand('add')
          .argument('<name>', 'Rule name (kebab-case)')
          .description('Scaffold a new custom rule')
          .option('--scope <scope>', 'Where to add the rule: local or global', 'global')
          .action(addRule)
      )
      .addCommand(createCommand('list').description('List all available rules').action(listRules))
  )
  .addCommand(createCommand('config').description('Print configuration (global, local, merged)').action(config))
  .addCommand(
    createCommand('check')
      .argument('[files...]', 'Files to check')
      .description('Check files against rules')
      .option('--json', 'Output results as JSON')
      .option('--quiet', 'Only show files with violations')
      .option('--timing', 'Print timing/performance breakdown to stderr')
      .action(check)
  )
  .addCommand(claudeCommand())
  .parse()

function addRule(name: string, options: { scope: string }) {
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) {
    process.stderr.write(`guardrail: rule name must be kebab-case (e.g. my-rule, no-console)\n`)
    process.exit(1)
  }

  const env = Env.create(process.cwd(), homedir())

  const rulesDir = options.scope === 'global' ? env.paths.global.rulesDir : env.paths.local.rulesDir

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
}

async function listRules() {
  const gr = await Guardrail.load()
  for (const { ruleId, severity, description } of gr.listRules()) {
    console.log(`${ruleId}  (${severity})  ${description}`)
  }
}

async function config() {
  try {
    const gr = await Guardrail.load()
    console.log(JSON.stringify(gr.config.toJson(), null, 2))
  } catch (err) {
    if (err instanceof ConfigLoadError) {
      process.stderr.write(`guardrail: ${err.message}\n`)
      process.exit(1)
    }
    throw err
  }
}

async function check(
  targets: string[],
  options: { json: boolean; quiet: boolean; timing: boolean }
) {
  try {
    const gr = await Guardrail.load()

    const results = await gr.check(targets.length === 0 ? ['.'] : targets)
    outputResults(results, options)

    if (options.timing) {
      const report = buildReport(gr.getMetrics())
      process.stderr.write(`\n${formatReport(report)}\n`)
    }

    process.exit(results.some((r) => !r.passed) ? 1 : 0)
  } catch (err) {
    if (err instanceof ConfigLoadError) {
      process.stderr.write(`guardrail: ${err.message}\n`)
      process.exit(1)
    }
    throw err
  }
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