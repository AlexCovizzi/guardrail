import { describe, it, expect } from 'vitest'
import { validateConfig, ConfigValidationError } from './validation.js'
import { ConfigSchema } from '../core/types.js'

describe('validateConfig', () => {
  describe('severity', () => {
    it('defaults to "error" when not provided', () => {
      const result = validateConfig('rule', {}, {})
      expect(result.severity).toBe('error')
    })

    it('accepts "warning"', () => {
      const result = validateConfig('rule', {}, { severity: 'warning' })
      expect(result.severity).toBe('warning')
    })

    it('accepts "error"', () => {
      const result = validateConfig('rule', {}, { severity: 'error' })
      expect(result.severity).toBe('error')
    })

    it('throws on invalid severity', () => {
      expect(() => validateConfig('my-rule', {}, { severity: 'warn' })).toThrow(
        ConfigValidationError
      )
      expect(() => validateConfig('my-rule', {}, { severity: 'warn' })).toThrow(
        'Rule "my-rule": option "severity" must be one of "error", "warning", got "warn"'
      )
    })
  })

  describe('number field', () => {
    const schema = {
      max: { type: 'number', default: 10, min: 1, max: 100 },
    } satisfies ConfigSchema

    it('applies default when not provided', () => {
      expect(validateConfig('rule', schema, {}).max).toBe(10)
    })

    it('accepts a valid number', () => {
      expect(validateConfig('rule', schema, { max: 50 }).max).toBe(50)
    })

    it('throws when value is not a number', () => {
      expect(() => validateConfig('my-rule', schema, { max: 'fifty' })).toThrow(
        'Rule "my-rule": option "max" must be a number, got string'
      )
    })

    it('throws when value is below min', () => {
      expect(() => validateConfig('my-rule', schema, { max: 0 })).toThrow(
        'Rule "my-rule": option "max" must be >= 1, got 0'
      )
    })

    it('throws when value exceeds max', () => {
      expect(() => validateConfig('my-rule', schema, { max: 101 })).toThrow(
        'Rule "my-rule": option "max" must be <= 100, got 101'
      )
    })

    it('throws when required and not provided', () => {
      const required = { count: { type: 'number' } } satisfies ConfigSchema
      expect(() => validateConfig('my-rule', required, {})).toThrow(
        'Rule "my-rule": option "count" is required'
      )
    })
  })

  describe('string field', () => {
    const schema = {
      name: { type: 'string', default: 'foo', minLength: 2, maxLength: 5 },
    } satisfies ConfigSchema

    it('applies default when not provided', () => {
      expect(validateConfig('rule', schema, {}).name).toBe('foo')
    })

    it('accepts a valid string', () => {
      expect(validateConfig('rule', schema, { name: 'bar' }).name).toBe('bar')
    })

    it('throws when value is not a string', () => {
      expect(() => validateConfig('my-rule', schema, { name: 42 })).toThrow(
        'Rule "my-rule": option "name" must be a string, got number'
      )
    })

    it('throws when value is below minLength', () => {
      expect(() => validateConfig('my-rule', schema, { name: 'x' })).toThrow(
        'Rule "my-rule": option "name" must have at least 2 characters'
      )
    })

    it('throws when value exceeds maxLength', () => {
      expect(() => validateConfig('my-rule', schema, { name: 'toolong' })).toThrow(
        'Rule "my-rule": option "name" must have at most 5 characters'
      )
    })
  })

  describe('boolean field', () => {
    const schema = {
      strict: { type: 'boolean', default: false },
    } satisfies ConfigSchema

    it('applies default when not provided', () => {
      expect(validateConfig('rule', schema, {}).strict).toBe(false)
    })

    it('accepts true', () => {
      expect(validateConfig('rule', schema, { strict: true }).strict).toBe(true)
    })

    it('accepts false', () => {
      expect(validateConfig('rule', schema, { strict: false }).strict).toBe(false)
    })

    it('throws when value is not a boolean', () => {
      expect(() => validateConfig('my-rule', schema, { strict: 'yes' })).toThrow(
        'Rule "my-rule": option "strict" must be a boolean, got string'
      )
    })
  })

  describe('enum field', () => {
    const schema = {
      mode: { type: 'enum', values: ['a', 'b', 'c'] as const, default: 'a' },
    } satisfies ConfigSchema

    it('applies default when not provided', () => {
      expect(validateConfig('rule', schema, {}).mode).toBe('a')
    })

    it('accepts a valid value', () => {
      expect(validateConfig('rule', schema, { mode: 'b' }).mode).toBe('b')
    })

    it('throws on invalid value', () => {
      expect(() => validateConfig('my-rule', schema, { mode: 'd' })).toThrow(
        'Rule "my-rule": option "mode" must be one of "a", "b", "c", got "d"'
      )
    })

    it('throws when required and not provided', () => {
      const required = { mode: { type: 'enum', values: ['x', 'y'] as const } } satisfies ConfigSchema
      expect(() => validateConfig('my-rule', required, {})).toThrow(
        'Rule "my-rule": option "mode" is required'
      )
    })
  })

  describe('multiple fields', () => {
    const schema = {
      max: { type: 'number', default: 10 },
      strict: { type: 'boolean', default: false },
    } satisfies ConfigSchema

    it('resolves all fields', () => {
      const result = validateConfig('rule', schema, { max: 20 })
      expect(result.max).toBe(20)
      expect(result.strict).toBe(false)
      expect(result.severity).toBe('error')
    })
  })
})