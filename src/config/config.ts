import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
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
  ignore?: string[]
}

const GLOBAL_CONFIG_DIR = envPaths('guardrail', { suffix: '' }).config
const GLOBAL_CONFIG_PATH = join(GLOBAL_CONFIG_DIR, 'config.yaml')

const DEFAULT_CONFIG = `# Guardrail global configuration
# https://github.com/alexcovizzi/guardrail

ignore:
  # General
  - .git
  - vendor

  # JavaScript / TypeScript
  - node_modules
  - dist
  - .next
  - .nuxt
  - coverage
  - "*.min.js"
  - "*.min.jsx"
  - "*.min.ts"
  - "*.min.tsx"

  # Python
  - __pycache__
  - .venv
  - venv
  - env
  - .tox
  - .mypy_cache
  - "*.pyc"

  # Java / Kotlin
  - build
  - out
  - target
  - .gradle
  - .idea
`

function ensureGlobalConfig(): void {
  if (existsSync(GLOBAL_CONFIG_PATH)) return
  mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true })
  writeFileSync(GLOBAL_CONFIG_PATH, DEFAULT_CONFIG)
}

function loadGlobalConfig(): RawConfig {
  if (!existsSync(GLOBAL_CONFIG_PATH)) return {}
  return (explorer.load(GLOBAL_CONFIG_PATH)?.config as RawConfig) ?? {}
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
  if (base.ignore || override.ignore) {
    merged.ignore = [...(base.ignore ?? []), ...(override.ignore ?? [])]
  }
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
  if (raw.ignore !== undefined) {
    if (!Array.isArray(raw.ignore) || !raw.ignore.every((v) => typeof v === 'string')) {
      throw new ConfigLoadError('"ignore" must be an array of glob strings')
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
    ensureGlobalConfig()
    const globalConfig = loadGlobalConfig()
    const localConfig = loadLocalConfig(cwd)
    validateStructure(globalConfig)
    validateStructure(localConfig)
    return new Config(mergeConfigs(globalConfig, localConfig))
  }

  static loadRaw(cwd: string = process.cwd()): { global: RawConfig; local: RawConfig; merged: RawConfig } {
    ensureGlobalConfig()
    const globalConfig = loadGlobalConfig()
    const localConfig = loadLocalConfig(cwd)
    validateStructure(globalConfig)
    validateStructure(localConfig)
    return { global: globalConfig, local: localConfig, merged: mergeConfigs(globalConfig, localConfig) }
  }

  static getGlobalConfigPath(): string {
    return GLOBAL_CONFIG_PATH
  }

  static getLocalConfigPath(cwd: string): string | null {
    const result = explorer.search(cwd)
    return result?.filepath ?? null
  }

  forLanguage(language: string): LanguageConfig {
    return new LanguageConfig(this.data, language)
  }

  getConfiguredRuleIds(): Set<string> {
    const ids = new Set<string>()
    for (const id of Object.keys(this.data.rules ?? {})) ids.add(id)
    for (const override of Object.values(this.data.overrides ?? {})) {
      for (const id of Object.keys(override.rules ?? {})) ids.add(id)
    }
    return ids
  }

  getIgnorePatterns(): string[] {
    return this.data.ignore ?? []
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
