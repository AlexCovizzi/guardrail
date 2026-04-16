import type { FileConfig } from '../config/file-config.js'
import { RuleConfig } from '../config/rule-config.js'
import type { Env } from '../core/env.js'
import { registerBuiltins } from './builtin/index.js'
import { discoverRules } from './discovery.js'
import type { RegisterFn, Rule, RuleDefinition } from './rule.js'

type RuleEntry = {
  ruleId: string
  definition: RuleDefinition
}

export class RuleRegistry {
  private entries: RuleEntry[] = []

  static async load(env: Env): Promise<RuleRegistry> {
    const registry = new RuleRegistry()

    const register = registry.register.bind(registry)
    registerBuiltins(register)
    await discoverRules(env, register)
    return registry
  }

  register(ruleId: string, definition: RuleDefinition): void {
    if (this.entries.some((e) => e.ruleId === ruleId)) {
      throw new Error(`Duplicate rule registration: "${ruleId}"`)
    }
    this.entries.push({ ruleId, definition })
  }

  createRules(fileConfig: FileConfig): Rule[] {
    const rules: Rule[] = []
    for (const { ruleId, definition } of this.entries) {
      const ruleConfig = fileConfig.forRule(ruleId)
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

  getEntries(): RuleEntry[] {
    return [...this.entries]
  }

  getRuleIds(): Set<string> {
    return new Set(this.entries.map((e) => e.ruleId))
  }
}
