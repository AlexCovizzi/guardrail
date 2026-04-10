import { Rule, Config, RuleConfig } from '../core/types.js'
import { RuleRegistry } from './registry.js'
import { registerBuiltins } from './builtin/index.js'
import { discoverRules } from './discovery.js'
import { ConfigBuilderImpl } from '../config/builder.js'

function isEnabled(rc: RuleConfig): boolean {
  if (rc.enabled !== undefined) return rc.enabled
  return !rc.disabled
}

export async function loadRules(config: Config): Promise<Rule[]> {
  const registry = new RuleRegistry()

  registerBuiltins(registry)

  await discoverRules(registry)

  const rules: Rule[] = []
  for (const { id, definition } of registry.getEntries()) {
    const rc = config.rules?.[id] ?? {}
    const builder = new ConfigBuilderImpl(id, rc)
    const visitors = definition.create(builder)
    const severity = (rc.severity as 'error' | 'warning' | undefined) ?? definition.defaultSeverity ?? 'error'
    const rule: Rule = { id, description: definition.description, severity, visitors, enabled: isEnabled(rc) }

    if (rule.enabled) rules.push(rule)
  }

  return rules
}
