import type { ConfigData } from './config-data.js'
import { RuleConfig } from './rule-config.js'

export class LanguageConfig {
  constructor(
    private base: ConfigData,
    private language: string
  ) {}

  forRule(ruleId: string): RuleConfig {
    const baseRule = this.base.rules?.[ruleId] ?? {}
    const overrideRule = this.base.overrides?.[this.language]?.rules?.[ruleId]
    const merged = overrideRule ? { ...baseRule, ...overrideRule } : baseRule
    return new RuleConfig(ruleId, merged)
  }
}
