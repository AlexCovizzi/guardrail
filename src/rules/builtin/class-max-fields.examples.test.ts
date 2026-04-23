import { describe, expect, it } from 'vitest'
import { collectViolations, getBuiltinRule, matchesAnyNode } from '../../test/helpers.js'

function makeFields(n: number, indent = '  ') {
  return Array.from({ length: n }, (_, i) => `${indent}field${i + 1}: number = ${i}`).join('\n')
}

describe('class-max-fields examples', () => {
  describe('typescript', () => {
    const valid = [
      {
        description: 'class with fewer fields than max',
        code: `class Foo {\n${makeFields(3)}\n}`,
      },
      {
        description: 'class with exactly max fields',
        code: `class Foo {\n${makeFields(5)}\n}`,
      },
    ]

    const invalid = [
      {
        description: 'class exceeding max fields',
        code: `class Foo {\n${makeFields(6)}\n}`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-fields', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-fields', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })

    it('reports correct field count in violation', async () => {
      const rule = getBuiltinRule('class-max-fields', { max: 5 })
      const code = `class Foo {\n${makeFields(6)}\n}`
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('6 fields')
      expect(violations[0]).toContain('max: 5')
    })
  })

  describe('javascript', () => {
    const valid = [
      {
        description: 'class with fewer fields than max',
        code: `class Foo {\n${Array.from({ length: 3 }, (_, i) => `  field${i + 1} = ${i}`).join('\n')}\n}`,
      },
    ]

    const invalid = [
      {
        description: 'class exceeding max fields',
        code: `class Foo {\n${Array.from({ length: 6 }, (_, i) => `  field${i + 1} = ${i}`).join('\n')}\n}`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-fields', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-fields', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(true)
    })
  })

  describe('python', () => {
    function makePyFields(n: number) {
      return Array.from({ length: n }, (_, i) => `    field${i + 1}: int = ${i}`).join('\n')
    }

    const valid = [
      {
        description: 'class with fewer fields than max',
        code: `class Foo:\n${makePyFields(3)}`,
      },
    ]

    const invalid = [
      {
        description: 'class exceeding max fields',
        code: `class Foo:\n${makePyFields(6)}`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-fields', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-fields', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(true)
    })
  })

  describe('java', () => {
    const valid = [
      {
        description: 'class with fewer fields than max',
        code: `class Foo {\n${Array.from({ length: 3 }, (_, i) => `  int field${i + 1} = ${i};`).join('\n')}\n}`,
      },
    ]

    const invalid = [
      {
        description: 'class exceeding max fields',
        code: `class Foo {\n${Array.from({ length: 6 }, (_, i) => `  int field${i + 1} = ${i};`).join('\n')}\n}`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-fields', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-fields', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(true)
    })
  })

  describe('kotlin', () => {
    const valid = [
      {
        description: 'class with fewer fields than max',
        code: `class Foo {\n${Array.from({ length: 3 }, (_, i) => `  val field${i + 1} = ${i}`).join('\n')}\n}`,
      },
    ]

    const invalid = [
      {
        description: 'class exceeding max fields',
        code: `class Foo {\n${Array.from({ length: 6 }, (_, i) => `  val field${i + 1} = ${i}`).join('\n')}\n}`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-fields', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('class-max-fields', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(true)
    })
  })

  describe('scope isolation — class scope only sees field selectors', () => {
    it('method local variables are not counted as class fields', async () => {
      const rule = getBuiltinRule('class-max-fields', { max: 2 })
      const code = [
        'class Foo {',
        '  field1 = 1',
        '  field2 = 2',
        '  method() {',
        '    const localA = 10',
        '    const localB = 20',
        '    const localC = 30',
        '  }',
        '}',
      ].join('\n')
      // 2 fields (field1, field2), locals inside method belong to function scope
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('uses correct default severity', () => {
      const rule = getBuiltinRule('class-max-fields')
      expect(rule.severity).toBe('error')
    })
  })
})
