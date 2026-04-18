import { describe, expect, it } from 'vitest'
import { collectViolations, getBuiltinRule, matchesAnyNode } from '../../test/helpers.js'

function makeMethods(n: number, indent = '  ') {
  return Array.from({ length: n }, (_, i) => `${indent}method${i + 1}() {}`).join('\n')
}

describe('class-max-methods examples', () => {
  describe('typescript', () => {
    const valid = [
      {
        description: 'class with fewer methods than max',
        code: `class Foo {\n${makeMethods(3)}\n}`,
      },
      {
        description: 'class with exactly max methods',
        code: `class Foo {\n${makeMethods(5)}\n}`,
      },
    ]

    const invalid = [
      {
        description: 'class exceeding max methods',
        code: `class Foo {\n${makeMethods(6)}\n}`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-methods', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-methods', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })

    it('reports correct method count in violation', async () => {
      const rule = getBuiltinRule('class-max-methods', { max: 5 })
      const code = `class Foo {\n${makeMethods(6)}\n}`
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('6 methods')
      expect(violations[0]).toContain('max: 5')
    })
  })

  describe('javascript', () => {
    const valid = [
      {
        description: 'class with fewer methods than max',
        code: `class Foo {\n${makeMethods(3)}\n}`,
      },
    ]

    const invalid = [
      {
        description: 'class exceeding max methods',
        code: `class Foo {\n${makeMethods(6)}\n}`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-methods', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-methods', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(true)
    })
  })

  describe('python', () => {
    function makePyMethods(n: number) {
      return Array.from({ length: n }, (_, i) => `    def method${i + 1}(self): pass`).join('\n')
    }

    const valid = [
      {
        description: 'class with fewer methods than max',
        code: `class Foo:\n${makePyMethods(3)}`,
      },
    ]

    const invalid = [
      {
        description: 'class exceeding max methods',
        code: `class Foo:\n${makePyMethods(6)}`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-methods', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-methods', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(true)
    })
  })

  describe('java', () => {
    const valid = [
      {
        description: 'class with fewer methods than max',
        code: `class Foo {\n${Array.from({ length: 3 }, (_, i) => `  void method${i + 1}() {}`).join('\n')}\n}`,
      },
    ]

    const invalid = [
      {
        description: 'class exceeding max methods',
        code: `class Foo {\n${Array.from({ length: 6 }, (_, i) => `  void method${i + 1}() {}`).join('\n')}\n}`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-methods', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-methods', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(true)
    })
  })

  describe('kotlin', () => {
    function makeKtMethods(n: number) {
      return Array.from({ length: n }, (_, i) => `  fun method${i + 1}() {}`).join('\n')
    }

    const valid = [
      {
        description: 'class with fewer methods than max',
        code: `class Foo {\n${makeKtMethods(3)}\n}`,
      },
    ]

    const invalid = [
      {
        description: 'class exceeding max methods',
        code: `class Foo {\n${makeKtMethods(6)}\n}`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-methods', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-methods', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('uses correct default severity', () => {
      const rule = getBuiltinRule('class-max-methods')
      expect(rule.severity).toBe('error')
    })
  })
})
