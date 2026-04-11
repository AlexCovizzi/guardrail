import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { cosmiconfigSync } from 'cosmiconfig'
import { TypeScriptLoader } from 'cosmiconfig-typescript-loader'
import envPaths from 'env-paths'
import { RuleConfig } from './rule-config.js'

const explorer = cosmiconfigSync('guardrail', {
  searchPlaces: ['.guardrail.yaml', '.guardrail.yml', '.guardrail.json', '.guardrail.js', '.guardrail.ts'],
  loaders: {
    '.ts': TypeScriptLoader(),
  },
})

interface RawConfig {
  rules?: Record<string, Record<string, unknown>>
  overrides?: Record<string, { rules?: Record<string, Record<string, unknown>> }>
}

function loadGlobalConfig(): RawConfig {
  const configFile = join(envPaths('guardrail', { suffix: '' }).config, 'config.yaml')
  if (!existsSync(configFile)) return {}
  return (explorer.load(configFile)?.config as RawConfig) ?? {}
}

function loadLocalConfig(cwd: string): RawConfig {
  return (explorer.search(cwd)?.config as RawConfig) ?? {}
}

function mergeConfigs(base: RawConfig, override: RawConfig): RawConfig {
  const merged: RawConfig = { ...base, ...override }
  if (base.rules || override.rules) {
    merged.rules = { ...base.rules, ...override.rules }
  }
  const overrides = mergeOverrides(base.overrides, override.overrides)
  if (overrides) merged.overrides = overrides
  return merged
}

function mergeOverrides(base: RawConfig['overrides'], override: RawConfig['overrides']): RawConfig['overrides'] {
  if (!base && !override) return undefined
  const keys = new Set([...Object.keys(base ?? {}), ...Object.keys(override ?? {})])
  return Object.fromEntries(
    [...keys].map((lang) => [lang, { rules: { ...base?.[lang]?.rules, ...override?.[lang]?.rules } }])
  )
}

function validateStructure(raw: RawConfig): void {
  if (raw.rules !== undefined) {
    if (typeof raw.rules !== 'object' || raw.rules === null || Array.isArray(raw.rules)) {
      throw new ConfigLoadError('"rules" must be an object')
    }
    for (const [id, rc] of Object.entries(raw.rules)) {
      if (typeof rc !== 'object' || rc === null || Array.isArray(rc)) {
        throw new ConfigLoadError(`rule "${id}" config must be an object`)
      }
      if ('severity' in rc && rc.severity !== 'error' && rc.severity !== 'warning') {
        throw new ConfigLoadError(`rule "${id}": severity must be "error" or "warning", got "${rc.severity}"`)
      }
      if ('enabled' in rc && typeof rc.enabled !== 'boolean') {
        throw new ConfigLoadError(`rule "${id}": enabled must be a boolean`)
      }
      if ('disabled' in rc && typeof rc.disabled !== 'boolean') {
        throw new ConfigLoadError(`rule "${id}": disabled must be a boolean`)
      }
    }
  }
  if (raw.overrides !== undefined) {
    if (typeof raw.overrides !== 'object' || raw.overrides === null || Array.isArray(raw.overrides)) {
      throw new ConfigLoadError('"overrides" must be an object')
    }
    for (const [lang, val] of Object.entries(raw.overrides)) {
      if (typeof val !== 'object' || val === null || Array.isArray(val)) {
        throw new ConfigLoadError(`override for "${lang}" must be an object`)
      }
      if (val.rules !== undefined) {
        if (typeof val.rules !== 'object' || val.rules === null || Array.isArray(val.rules)) {
          throw new ConfigLoadError(`override for "${lang}": rules must be an object`)
        }
      }
    }
  }
}

export class ConfigLoadError extends Error {
  constructor(message: string) {
    super(`Invalid config: ${message}`)
    this.name = 'ConfigLoadError'
  }
}

export class Config {
  private constructor(private data: RawConfig) {}

  static load(cwd: string = process.cwd()): Config {
    const globalConfig = loadGlobalConfig()
    const localConfig = loadLocalConfig(cwd)
    validateStructure(globalConfig)
    validateStructure(localConfig)
    return new Config(mergeConfigs(globalConfig, localConfig))
  }

  forLanguage(language: string): LanguageConfig {
    return new LanguageConfig(this.data, language)
  }
}

export class LanguageConfig {
  constructor(
    private base: RawConfig,
    private language: string
  ) {}

  forRule(ruleId: string): RuleConfig {
    const baseRule = this.base.rules?.[ruleId] ?? {}
    const overrideRule = this.base.overrides?.[this.language]?.rules?.[ruleId]
    const merged = overrideRule ? { ...baseRule, ...overrideRule } : baseRule
    return new RuleConfig(ruleId, merged)
  }

  getRaw(): Record<string, Record<string, unknown>> {
    const base = this.base.rules ?? {}
    const override = this.base.overrides?.[this.language]?.rules ?? {}
    return { ...base, ...override }
  }
}
