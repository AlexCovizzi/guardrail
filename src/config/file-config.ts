import picomatch from 'picomatch'
import type { ConfigData } from './config-data.js'
import { RuleConfig } from './rule-config.js'

type OverrideValue = NonNullable<ConfigData['overrides']>[string]

export class FileConfig {
  private readonly matchingOverrides: OverrideValue[]

  constructor(
    private data: ConfigData,
    file: string
  ) {
    this.matchingOverrides = Object.entries(data.overrides ?? {})
      .filter(([glob]) => picomatch.isMatch(file, glob))
      .map(([, val]) => val)
  }

  forRule(ruleId: string): RuleConfig {
    const baseRule = this.data.rules?.[ruleId] ?? {}
    const merged = { ...baseRule }
    for (const val of this.matchingOverrides) {
      const overrideRule = val.rules?.[ruleId]
      if (overrideRule) Object.assign(merged, overrideRule)
    }
    return new RuleConfig(ruleId, merged)
  }
}
