import { describe, it, expect } from 'vitest'
import { resolveConfigForLanguage } from './resolver.js'
import { Config } from '../core/types.js'

describe('resolveConfigForLanguage', () => {
  it('returns config as-is when no overrides exist', () => {
    const config: Config = { rules: { 'function-length': { enabled: true } } }
    expect(resolveConfigForLanguage(config, 'typescript')).toBe(config)
  })

  it('returns config as-is when no override for the given language', () => {
    const config: Config = {
      rules: { 'function-length': { enabled: true } },
      overrides: { python: { rules: { 'function-length': { enabled: false } } } },
    }
    expect(resolveConfigForLanguage(config, 'typescript')).toBe(config)
  })

  it('merges language override rules on top of base rules', () => {
    const config: Config = {
      rules: {
        'function-length': { enabled: true, max: 20 },
        'function-complexity': { enabled: true },
      },
      overrides: {
        typescript: { rules: { 'function-length': { enabled: false } } },
      },
    }
    const result = resolveConfigForLanguage(config, 'typescript')
    expect(result.rules).toEqual({
      'function-length': { enabled: false },
      'function-complexity': { enabled: true },
    })
  })

  it('does not mutate the original config', () => {
    const config: Config = {
      rules: { 'function-length': { enabled: true } },
      overrides: {
        typescript: { rules: { 'function-length': { enabled: false } } },
      },
    }
    resolveConfigForLanguage(config, 'typescript')
    expect(config.rules?.['function-length']).toEqual({ enabled: true })
  })
})