import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { cosmiconfigSync } from 'cosmiconfig'
import { TypeScriptLoader } from 'cosmiconfig-typescript-loader'
import type { ConfigData } from './config-data.js'
import { FileConfig } from './file-config.js'
import { globalPaths } from './paths.js'
import recommendedPreset from './recommended-preset.js'

export type { ConfigData }

const explorer = cosmiconfigSync('guardrail', {
  searchPlaces: ['.guardrail.yaml', '.guardrail.yml', '.guardrail.json', '.guardrail.js', '.guardrail.ts'],
  loaders: {
    '.ts': TypeScriptLoader(),
  },
})

const PRESETS: Record<string, ConfigData> = {
  recommended: recommendedPreset,
}

const DEFAULT_CONFIG = `# Guardrail global configuration
# https://github.com/alexcovizzi/guardrail

extends: recommended
`

function ensureGlobalConfig(configDir: string, configPath: string): void {
  if (existsSync(configPath)) return
  mkdirSync(configDir, { recursive: true })
  writeFileSync(configPath, DEFAULT_CONFIG)
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

function loadGlobalConfig(configPath: string): ConfigData {
  if (!existsSync(configPath)) return {}
  return (explorer.load(configPath)?.config as ConfigData) ?? {}
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
    [...keys].map((glob) => [glob, { rules: { ...base?.[glob]?.rules, ...override?.[glob]?.rules } }])
  )
}

function validateRules(rules: unknown): void {
  if (rules === undefined) return
  if (typeof rules !== 'object' || rules === null || Array.isArray(rules)) {
    throw new ConfigLoadError('"rules" must be an object')
  }
  for (const [id, rc] of Object.entries(rules)) {
    if (typeof rc !== 'object' || rc === null || Array.isArray(rc)) {
      throw new ConfigLoadError(`rule "${id}" config must be an object`)
    }
    validateRuleConfig(id, rc as Record<string, unknown>)
  }
}

function validateRuleConfig(id: string, rc: Record<string, unknown>): void {
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

function validateOverrides(overrides: unknown): void {
  if (overrides === undefined) return
  if (typeof overrides !== 'object' || overrides === null || Array.isArray(overrides)) {
    throw new ConfigLoadError('"overrides" must be an object')
  }
  for (const [glob, val] of Object.entries(overrides)) {
    if (typeof val !== 'object' || val === null || Array.isArray(val)) {
      throw new ConfigLoadError(`override for "${glob}" must be an object`)
    }
    validateOverrideRules(glob, (val as Record<string, unknown>).rules)
  }
}

function validateOverrideRules(glob: string, rules: unknown): void {
  if (rules === undefined) return
  if (typeof rules !== 'object' || rules === null || Array.isArray(rules)) {
    throw new ConfigLoadError(`override for "${glob}": rules must be an object`)
  }
}

function validateExtends(extends_val: unknown): void {
  if (extends_val === undefined) return
  const isValid =
    typeof extends_val === 'string' || (Array.isArray(extends_val) && extends_val.every((v) => typeof v === 'string'))
  if (!isValid) throw new ConfigLoadError('"extends" must be a string or array of strings')
}

function validateIgnore(ignore: unknown): void {
  if (ignore === undefined) return
  if (!Array.isArray(ignore) || !ignore.every((v) => typeof v === 'string')) {
    throw new ConfigLoadError('"ignore" must be an array of glob strings')
  }
}

function validateStructure(data: ConfigData): void {
  validateRules(data.rules)
  validateOverrides(data.overrides)
  validateExtends(data.extends)
  validateIgnore(data.ignore)
}

export class ConfigLoadError extends Error {
  constructor(message: string) {
    super(`Invalid config: ${message}`)
    this.name = 'ConfigLoadError'
  }
}

export class Config {
  private constructor(private data: ConfigData) {}

  static async load(cwd: string, homeDir: string): Promise<Config> {
    const { configDir, configPath } = globalPaths(homeDir)
    ensureGlobalConfig(configDir, configPath)
    const globalConfig = resolveExtends(loadGlobalConfig(configPath))
    const localConfig = resolveExtends(loadLocalConfig(cwd))
    validateStructure(globalConfig)
    validateStructure(localConfig)
    return new Config(mergeConfigs(globalConfig, localConfig))
  }

  forFile(filename: string): FileConfig {
    return new FileConfig(this.data, filename)
  }

  getOverrides(): ConfigData['overrides'] {
    return this.data.overrides
  }

  getIgnorePatterns(): string[] {
    return this.data.ignore ?? []
  }

  toJson(): ConfigData {
    return this.data
  }
}
