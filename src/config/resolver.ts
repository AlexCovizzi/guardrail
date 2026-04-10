import { cosmiconfigSync } from 'cosmiconfig'
import { TypeScriptLoader } from 'cosmiconfig-typescript-loader'
import { existsSync } from 'fs'
import { join } from 'path'
import envPaths from 'env-paths'
import { Config } from '../core/types.js'

const explorer = cosmiconfigSync('guardrail', {
  searchPlaces: [
    '.guardrail.yaml',
    '.guardrail.yml',
    '.guardrail.json',
    '.guardrail.js',
    '.guardrail.ts',
  ],
  loaders: {
    '.ts': TypeScriptLoader(),
  },
})

function loadGlobalConfig(): Config {
  const configFile = join(envPaths('guardrail', { suffix: '' }).config, 'config.yaml')
  if (!existsSync(configFile)) return {}
  return (explorer.load(configFile)?.config as Config) ?? {}
}

function mergeOverrides(
  base: Config['overrides'],
  override: Config['overrides'],
): Config['overrides'] {
  if (!base && !override) return undefined
  const keys = new Set([...Object.keys(base ?? {}), ...Object.keys(override ?? {})])
  return Object.fromEntries(
    [...keys].map(lang => [
      lang,
      { rules: { ...base?.[lang]?.rules, ...override?.[lang]?.rules } },
    ]),
  )
}

function mergeConfigs(base: Config, override: Config): Config {
  const merged: Config = { ...base, ...override }
  if (base.rules || override.rules) {
    merged.rules = { ...base.rules, ...override.rules }
  }
  const overrides = mergeOverrides(base.overrides, override.overrides)
  if (overrides) merged.overrides = overrides
  return merged
}

export function loadConfig(cwd: string = process.cwd()): Config {
  const global = loadGlobalConfig()
  const local = (explorer.search(cwd)?.config as Config) ?? {}
  return mergeConfigs(global, local)
}

export function resolveConfigForLanguage(config: Config, language: string): Config {
  const override = config.overrides?.[language]
  if (!override) return config
  return {
    ...config,
    rules: { ...config.rules, ...override.rules },
  }
}
