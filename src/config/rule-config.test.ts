import { describe, expect, it } from 'vitest'
import { ConfigValidationError, RuleConfig } from './rule-config.js'

describe('RuleConfig', () => {
  it('returns default for missing key', () => {
    const rc = new RuleConfig('test', {})
    expect(rc.number('max', { default: 42 })).toBe(42)
    expect(rc.string('name', { default: 'hello' })).toBe('hello')
    expect(rc.boolean('flag', { default: true })).toBe(true)
  })

  it('returns configured value', () => {
    const rc = new RuleConfig('test', { max: 10, name: 'world', flag: false })
    expect(rc.number('max', { default: 42 })).toBe(10)
    expect(rc.string('name', { default: 'hello' })).toBe('world')
    expect(rc.boolean('flag', { default: true })).toBe(false)
  })

  it('validates number range', () => {
    const rc = new RuleConfig('test', { max: 5 })
    expect(rc.number('max', { default: 10, min: 1, max: 10 })).toBe(5)
    expect(() => rc.number('max', { default: 10, min: 10 })).toThrow(ConfigValidationError)
    expect(() => rc.number('max', { default: 10, max: 3 })).toThrow(ConfigValidationError)
  })

  it('rejects NaN', () => {
    const rc = new RuleConfig('test', { max: NaN })
    expect(() => rc.number('max', { default: 10 })).toThrow(ConfigValidationError)
  })

  it('validates string length', () => {
    const rc = new RuleConfig('test', { name: 'ab' })
    expect(rc.string('name', { default: '', minLength: 1, maxLength: 5 })).toBe('ab')
    expect(() => rc.string('name', { default: '', minLength: 3 })).toThrow(ConfigValidationError)
  })

  it('validates enum values', () => {
    const values = ['a', 'b', 'c'] as const
    expect(new RuleConfig('test', { mode: 'b' }).enum('mode', { values, default: 'a' })).toBe('b')
    expect(() => new RuleConfig('test', { mode: 'z' }).enum('mode', { values, default: 'a' })).toThrow(
      ConfigValidationError
    )
  })

  it('isEnabled uses enabled/disabled', () => {
    expect(new RuleConfig('test', { enabled: true }).isEnabled()).toBe(true)
    expect(new RuleConfig('test', { enabled: false }).isEnabled()).toBe(false)
    expect(new RuleConfig('test', { disabled: true }).isEnabled()).toBe(false)
    expect(new RuleConfig('test', {}).isEnabled()).toBe(true)
    expect(new RuleConfig('test', { enabled: true, disabled: true }).isEnabled()).toBe(true)
    expect(new RuleConfig('test', { enabled: false, disabled: false }).isEnabled()).toBe(false)
  })

  it('getSeverity uses severity with fallback', () => {
    expect(new RuleConfig('test', { severity: 'warning' }).getSeverity()).toBe('warning')
    expect(new RuleConfig('test', {}).getSeverity()).toBe('error')
    expect(new RuleConfig('test', {}).getSeverity('warning')).toBe('warning')
  })
})
