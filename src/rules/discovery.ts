import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import envPaths from 'env-paths'
import { createJiti } from 'jiti'
import { RuleRegistry } from './registry.js'
import type { RuleDefinition } from './rule.js'

const jiti = createJiti(import.meta.url)
const RULE_EXTENSIONS = ['.ts', '.js', '.mjs']

function isValidRuleDefinition(val: unknown): val is RuleDefinition {
  if (typeof val !== 'object' || val === null) return false
  const obj = val as Record<string, unknown>
  return typeof obj.description === 'string' && typeof obj.create === 'function'
}

async function discoverRulesInDir(registry: RuleRegistry, dir: string): Promise<void> {
  if (!existsSync(dir)) return

  const files = readdirSync(dir)
    .filter((f) => RULE_EXTENSIONS.some((ext) => f.endsWith(ext)))
    .sort()

  for (const file of files) {
    const filePath = join(dir, file)
    try {
      const mod = (await jiti.import(filePath)) as any
      const definition = mod.default ?? mod

      if (typeof definition === 'function') {
        definition(registry)
        continue
      }

      if (isValidRuleDefinition(definition)) {
        const ruleId = file.replace(/\.(ts|js|mjs)$/, '')
        registry.register(ruleId, definition)
        continue
      }

      process.stderr.write(
        `guardrail: ${file}: expected a RuleDefinition ({ description, create }) or a register function, got ${typeof definition}\n`
      )
    } catch (err) {
      process.stderr.write(`guardrail: failed to load rule ${file}: ${(err as Error).message}\n`)
    }
  }
}

export async function discoverRules(registry: RuleRegistry): Promise<void> {
  const globalDir = join(envPaths('guardrail', { suffix: '' }).config, 'rules')
  const localDir = join(process.cwd(), '.guardrail', 'rules')
  await discoverRulesInDir(registry, globalDir)
  await discoverRulesInDir(registry, localDir)
}
