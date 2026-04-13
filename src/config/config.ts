import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cosmiconfigSync } from 'cosmiconfig'
import { TypeScriptLoader } from 'cosmiconfig-typescript-loader'
import type { ConfigData } from './config-data.js'
import { LanguageConfig } from './language-config.js'
import { GLOBAL_CONFIG_DIR, GLOBAL_CONFIG_PATH } from './paths.js'
import { RECOMMENDED_PRESET } from './presets.js'

export { type ConfigData, LanguageConfig }

const explorer = cosmiconfigSync('guardrail', {
  searchPlaces: ['.guardrail.yaml', '.guardrail.yml', '.guardrail.json', '.guardrail.js', '.guardrail.ts'],
  loaders: {
    '.ts': TypeScriptLoader(),
  },
})

const PRESETS: Record<string, ConfigData> = {
  recommended: RECOMMENDED_PRESET,
}

const DEFAULT_CONFIG = `# Guardrail global configuration
# https://github.com/alexcovizzi/guardrail

extends: recommended
`

function ensureGlobalConfig(): void {
  if (existsSync(GLOBAL_CONFIG_PATH)) return
  mkdirSync(GLOBAL_CONFIG_DIR, { recursive: true })
  writeFileSync(GLOBAL_CONFIG_PATH, DEFAULT_CONFIG)
}

function resolveExtends(raw: ConfigData): ConfigData {
  const presets = normalizeExtends(raw.extends)
  if (presets.length === 0) return raw
  let base: ConfigData = {}
  for (const name of presets) {
    const preset = PRESETS[name]
    if (!preset) throw new ConfigLoadError(`Unknown preset "${name}". Available: ${Object.keys(PRESETS).join(', ')}`)
    base = mergeConfigs(base, preset)
  }
  const { extends: _, ...rest } = raw
  return mergeConfigs(base, rest)
}

function normalizeExtends(extends_val: ConfigData['extends']): string[] {
  if (!extends_val) return []
  return Array.isArray(extends_val) ? extends_val : [extends_val]
}

function loadGlobalConfig(): ConfigData {
  if (!existsSync(GLOBAL_CONFIG_PATH)) return {}
  return (explorer.load(GLOBAL_CONFIG_PATH)?.config as ConfigData) ?? {}
}

function loadLocalConfig(cwd: string): ConfigData {
  return (explorer.search(cwd)?.config as ConfigData) ?? {}
}

function mergeIgnoreLists(base: string[], override: string[]): string[] {
  const negations = new Set(override.filter((p) => p.startsWith('!')).map((p) => p.slice(1)))
  const filteredBase = base.filter((p) => !negations.has(p))
  const additions = override.filter((p) => !p.startsWith('!'))
  return [...new Set([...filteredBase, ...additions])]
}

function mergeConfigs(base: ConfigData, override: ConfigData): ConfigData {
  const merged: ConfigData = { ...base, ...override }
  if (base.rules || override.rules) {
    merged.rules = { ...base.rules, ...override.rules }
  }
  const overrides = mergeOverrides(base.overrides, override.overrides)
  if (overrides) merged.overrides = overrides
  if (base.ignore || override.ignore) {
    merged.ignore = mergeIgnoreLists(base.ignore ?? [], override.ignore ?? [])
  }
  return merged
}

function mergeOverrides(base: ConfigData['overrides'], override: ConfigData['overrides']): ConfigData['overrides'] {
  if (!base && !override) return undefined
  const keys = new Set([...Object.keys(base ?? {}), ...Object.keys(override ?? {})])
  return Object.fromEntries(
    [...keys].map((lang) => [lang, { rules: { ...base?.[lang]?.rules, ...override?.[lang]?.rules } }])
  )
}

function validateStructure(raw: ConfigData): void {
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
  if (raw.extends !== undefined) {
    const val = raw.extends
    const isValid = typeof val === 'string' || (Array.isArray(val) && val.every((v) => typeof v === 'string'))
    if (!isValid) throw new ConfigLoadError('"extends" must be a string or array of strings')
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
  private constructor(private data: ConfigData) {}

  static load(cwd: string = process.cwd()): Config {
    ensureGlobalConfig()
    const globalConfig = resolveExtends(loadGlobalConfig())
    const localConfig = resolveExtends(loadLocalConfig(cwd))
    validateStructure(globalConfig)
    validateStructure(localConfig)
    return new Config(mergeConfigs(globalConfig, localConfig))
  }

  static loadData(cwd: string = process.cwd()): { global: ConfigData; local: ConfigData; merged: ConfigData } {
    ensureGlobalConfig()
    const globalConfig = resolveExtends(loadGlobalConfig())
    const localConfig = resolveExtends(loadLocalConfig(cwd))
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
