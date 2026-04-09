import { Rule, Config, RuleConfig } from '../core/types.js'
import { RuleRegistry } from './registry.js'
import { registerBuiltins } from './builtin/index.js'
import { discoverRules } from './discovery.js'
import { validateConfig } from '../config/validation.js'

function isEnabled(rc: RuleConfig): boolean {
  if (rc.enabled !== undefined) return rc.enabled
  return !rc.disabled
}

export async function loadRules(config: Config): Promise<Rule[]> {
  const registry = new RuleRegistry()

  registerBuiltins(registry)

  await discoverRules(registry)

  const rules: Rule[] = []
  for (const { id, schema, create } of registry.getEntries()) {
    const rc = config.rules?.[id] ?? {}
    const resolved = validateConfig(id, schema, rc)
    const rule: Rule = { id, ...create(resolved) }

    rule.enabled = isEnabled(rc)
    if (rule.enabled) rules.push(rule)
  }

  return rules
}