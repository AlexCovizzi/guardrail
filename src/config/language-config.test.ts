import { describe, expect, it } from 'vitest'
import { LanguageConfig } from './language-config.js'

describe('LanguageConfig', () => {
  it('returns base rules when no override for language', () => {
    const config = new LanguageConfig({ rules: { 'function-length': { max: 20 } } }, 'typescript')
    const rc = config.forRule('function-length')
    expect(rc.number('max', { default: 0 })).toBe(20)
  })

  it('returns default when rule not in config', () => {
    const config = new LanguageConfig({}, 'typescript')
    const rc = config.forRule('nonexistent')
    expect(rc.number('max', { default: 99 })).toBe(99)
  })

  it('merges override per-property', () => {
    const config = new LanguageConfig(
      {
        rules: { 'function-length': { max: 20, enabled: true } },
        overrides: { typescript: { rules: { 'function-length': { max: 10 } } } },
      },
      'typescript'
    )
    const rc = config.forRule('function-length')
    expect(rc.number('max', { default: 0 })).toBe(10)
    expect(rc.isEnabled()).toBe(true)
  })

  it('does not mutate original config', () => {
    const raw = {
      rules: { 'function-length': { max: 20 } },
      overrides: { typescript: { rules: { 'function-length': { max: 10 } } } },
    }
    const tsConfig = new LanguageConfig(raw, 'typescript')
    tsConfig.forRule('function-length')
    const rc2 = new LanguageConfig(raw, 'python').forRule('function-length')
    expect(rc2.number('max', { default: 0 })).toBe(20)
  })
})
