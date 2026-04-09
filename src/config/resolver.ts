import { cosmiconfigSync } from 'cosmiconfig'
import { TypeScriptLoader } from 'cosmiconfig-typescript-loader'
import { Config } from '../core/types.js'

const explorer = cosmiconfigSync('guardrail', {
  searchPlaces: [
    'package.json',
    '.guardrailrc',
    '.guardrailrc.json',
    '.guardrailrc.yaml',
    '.guardrailrc.yml',
    '.guardrailrc.js',
    '.guardrailrc.ts',
    'guardrail.config.js',
    'guardrail.config.ts',
  ],
  loaders: {
    '.ts': TypeScriptLoader(),
  },
})

export function loadConfig(cwd: string = process.cwd()): Config {
  const result = explorer.search(cwd)
  return result?.config as Config
}

export function resolveConfigForLanguage(config: Config, language: string): Config {
  const override = config.overrides?.[language]
  if (!override) return config
  return {
    ...config,
    rules: { ...config.rules, ...override.rules },
  }
}
