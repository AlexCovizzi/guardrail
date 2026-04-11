import type { LanguageConfig } from '../config/config.js'
import { registerBuiltins } from './builtin/index.js'
import { discoverRules } from './discovery.js'
import { RuleRegistry } from './registry.js'
import {Rule} from "./rule.js";

export async function loadRules(langConfig: LanguageConfig): Promise<Rule[]> {
  const registry = new RuleRegistry()

  registerBuiltins(registry)

  await discoverRules(registry)

  const rules: Rule[] = []
  for (const { ruleId, definition } of registry.getEntries()) {
    const ruleConfig = langConfig.forRule(ruleId)
    const visitors = definition.create(ruleConfig)
    const severity = ruleConfig.getSeverity(definition.defaultSeverity)
    const rule: Rule = {
      id: ruleId,
      description: definition.description,
      severity,
      visitors,
      enabled: ruleConfig.isEnabled(),
    }

    if (rule.enabled) rules.push(rule)
  }

  return rules
}
