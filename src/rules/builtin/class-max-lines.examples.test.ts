import { describe, expect, it } from 'vitest'
import { collectViolations, getBuiltinRule, matchesAnyNode } from '../../test/helpers.js'

describe('class-max-lines examples', () => {
  describe('typescript', () => {
    const valid = [
      {
        description: 'short class',
        code: `class Foo {\n  x = 1\n}`,
      },
      {
        description: 'class at exactly max lines',
        code: Array.from({ length: 8 }, (_, i) => (i === 0 ? 'class Foo {' : i === 7 ? '}' : `  x${i} = ${i}`)).join(
          '\n'
        ),
      },
    ]

    const invalid = [
      {
        description: 'class exceeding max lines',
        code: Array.from({ length: 12 }, (_, i) => (i === 0 ? 'class Foo {' : i === 11 ? '}' : `  x${i} = ${i}`)).join(
          '\n'
        ),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })

    it('reports correct line count in violation', async () => {
      const rule = getBuiltinRule('class-max-lines', { max: 10 })
      const code = Array.from({ length: 12 }, (_, i) =>
        i === 0 ? 'class Foo {' : i === 11 ? '}' : `  x${i} = ${i}`
      ).join('\n')
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('12 lines')
      expect(violations[0]).toContain('max: 10')
    })
  })

  describe('javascript', () => {
    const valid = [
      {
        description: 'short class',
        code: `class Foo {\n  x = 1\n}`,
      },
    ]

    const invalid = [
      {
        description: 'class exceeding max lines',
        code: Array.from({ length: 12 }, (_, i) => (i === 0 ? 'class Foo {' : i === 11 ? '}' : `  x${i} = ${i}`)).join(
          '\n'
        ),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(true)
    })
  })

  describe('python', () => {
    const valid = [
      {
        description: 'short class',
        code: `class Foo:\n    x = 1`,
      },
    ]

    const invalid = [
      {
        description: 'class exceeding max lines',
        code: ['class Foo:', ...Array.from({ length: 11 }, (_, i) => `    x${i} = ${i}`)].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(true)
    })

    it('reports correct line count in violation', async () => {
      const rule = getBuiltinRule('class-max-lines', { max: 10 })
      const code = ['class Foo:', ...Array.from({ length: 11 }, (_, i) => `    x${i} = ${i}`)].join('\n')
      const violations = await collectViolations(rule, code, 'python')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('lines')
      expect(violations[0]).toContain('max: 10')
    })
  })

  describe('java', () => {
    const valid = [
      {
        description: 'short class',
        code: `class Foo {\n  int x = 1;\n}`,
      },
    ]

    const invalid = [
      {
        description: 'class exceeding max lines',
        code: Array.from({ length: 12 }, (_, i) =>
          i === 0 ? 'class Foo {' : i === 11 ? '}' : `  int x${i} = ${i};`
        ).join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(true)
    })
  })

  describe('kotlin', () => {
    const valid = [
      {
        description: 'short class',
        code: `class Foo {\n  val x = 1\n}`,
      },
    ]

    const invalid = [
      {
        description: 'class exceeding max lines',
        code: Array.from({ length: 12 }, (_, i) =>
          i === 0 ? 'class Foo {' : i === 11 ? '}' : `  val x${i} = ${i}`
        ).join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('valid: empty class produces no violations', async () => {
      const rule = getBuiltinRule('class-max-lines', { max: 10 })
      expect(await collectViolations(rule, 'class Foo {}', 'typescript')).toEqual([])
    })

    it('uses correct default severity', () => {
      const rule = getBuiltinRule('class-max-lines')
      expect(rule.severity).toBe('error')
    })
  })
})
