import { describe, expect, it } from 'vitest'
import { collectViolations, getBuiltinRule, matchesAnyNode } from '../../test/helpers.js'

describe('function-max-lines examples', () => {
  describe('typescript', () => {
    const valid = [
      {
        description: 'short function declaration',
        code: `function greet(name: string): string {\n  return "hello " + name\n}`,
      },
      {
        description: 'short arrow function',
        code: `const add = (a: number, b: number) => a + b`,
      },
      {
        description: 'short method',
        code: `class Foo {\n  bar(): void {\n    console.log("hi")\n  }\n}`,
      },
      {
        description: 'function at exactly max lines',
        code: Array.from({ length: 10 }, (_, i) =>
          i === 0 ? 'function ten() {' : i === 9 ? '}' : `  const x${i} = ${i}`
        ).join('\n'),
      },
    ]

    const invalid = [
      {
        description: 'function declaration exceeding max lines',
        code: Array.from({ length: 12 }, (_, i) =>
          i === 0 ? 'function long() {' : i === 11 ? '}' : `  const x${i} = ${i}`
        ).join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })

    it('reports correct line count in violation message', async () => {
      const rule = getBuiltinRule('function-max-lines', { max: 10 })
      const code = Array.from({ length: 12 }, (_, i) =>
        i === 0 ? 'function long() {' : i === 11 ? '}' : `  const x${i} = ${i}`
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
        description: 'short function declaration',
        code: `function greet(name) {\n  return "hello " + name\n}`,
      },
    ]

    const invalid = [
      {
        description: 'function declaration exceeding max lines',
        code: Array.from({ length: 12 }, (_, i) =>
          i === 0 ? 'function long() {' : i === 11 ? '}' : `  var x${i} = ${i}`
        ).join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(true)
    })
  })

  describe('python', () => {
    const valid = [
      {
        description: 'short function',
        code: `def greet(name):\n    return "hello " + name`,
      },
    ]

    const invalid = [
      {
        description: 'function exceeding max lines',
        code: ['def long():', ...Array.from({ length: 11 }, (_, i) => `    x${i} = ${i}`)].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(true)
    })

    it('reports correct line count in violation message', async () => {
      const rule = getBuiltinRule('function-max-lines', { max: 10 })
      const code = ['def long():', ...Array.from({ length: 11 }, (_, i) => `    x${i} = ${i}`)].join('\n')
      const violations = await collectViolations(rule, code, 'python')
      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0]).toContain('lines')
      expect(violations[0]).toContain('max: 10')
    })
  })

  describe('java', () => {
    const valid = [
      {
        description: 'short method',
        code: `class Foo { int add(int a, int b) { return a + b; } }`,
      },
    ]

    const invalid = [
      {
        description: 'method exceeding max lines',
        code: [
          'class Foo {',
          '  void veryLongMethod() {',
          ...Array.from({ length: 11 }, (_, i) => `    int x${i} = ${i};`),
          '  }',
          '}',
        ].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(true)
    })
  })

  describe('kotlin', () => {
    const valid = [
      {
        description: 'short function',
        code: `fun add(a: Int, b: Int): Int = a + b`,
      },
    ]

    const invalid = [
      {
        description: 'function exceeding max lines',
        code: ['fun long() {', ...Array.from({ length: 11 }, (_, i) => `  val x${i} = ${i}`), '}'].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-lines', { max: 10 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('uses correct default severity', () => {
      const rule = getBuiltinRule('function-max-lines')
      expect(rule.severity).toBe('error')
    })
  })
})
