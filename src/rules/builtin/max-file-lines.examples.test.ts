import { describe, expect, it } from 'vitest'
import { collectViolations, getBuiltinRule, matchesAnyNode } from '../../test/helpers.js'

describe('max-file-lines examples', () => {
  describe('typescript', () => {
    const valid = [
      {
        description: 'short file',
        code: `function add(a: number, b: number) {\n  return a + b\n}`,
      },
      {
        description: 'file at exactly the max',
        code: Array.from({ length: 10 }, (_, i) => `const x${i} = ${i}`).join('\n'),
      },
    ]

    const invalid = [
      {
        description: 'file exceeding max lines',
        code: Array.from({ length: 15 }, (_, i) => `const x${i} = ${i}`).join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('max-file-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('max-file-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })

    it('reports correct line count in violation message', async () => {
      const rule = getBuiltinRule('max-file-lines', { max: 10 })
      const code = Array.from({ length: 15 }, (_, i) => `const x${i} = ${i}`).join('\n')
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('15 lines')
      expect(violations[0]).toContain('max: 10')
    })
  })

  describe('javascript', () => {
    const valid = [
      {
        description: 'short file',
        code: `function add(a, b) {\n  return a + b\n}`,
      },
    ]

    const invalid = [
      {
        description: 'file exceeding max lines',
        code: Array.from({ length: 15 }, (_, i) => `var x${i} = ${i}`).join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('max-file-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('max-file-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(true)
    })
  })

  describe('python', () => {
    const valid = [
      {
        description: 'short file',
        code: `def add(a, b):\n    return a + b`,
      },
    ]

    const invalid = [
      {
        description: 'file exceeding max lines',
        code: Array.from({ length: 15 }, (_, i) => `x${i} = ${i}`).join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('max-file-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('max-file-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(true)
    })
  })

  describe('java', () => {
    const valid = [
      {
        description: 'short file',
        code: `class Foo {\n  int x = 1;\n}`,
      },
    ]

    const invalid = [
      {
        description: 'file exceeding max lines',
        code: Array.from({ length: 15 }, (_, i) => `int x${i} = ${i};`).join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('max-file-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('max-file-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(true)
    })
  })

  describe('kotlin', () => {
    const valid = [
      {
        description: 'short file',
        code: `fun add(a: Int, b: Int): Int = a + b`,
      },
    ]

    const invalid = [
      {
        description: 'file exceeding max lines',
        code: Array.from({ length: 15 }, (_, i) => `val x${i} = ${i}`).join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('max-file-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('max-file-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('uses correct default severity (warning)', () => {
      const rule = getBuiltinRule('max-file-lines')
      expect(rule.severity).toBe('warning')
    })
  })
})
