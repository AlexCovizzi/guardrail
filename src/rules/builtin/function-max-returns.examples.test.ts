import { describe, expect, it } from 'vitest'
import { collectViolations, getBuiltinRule, matchesAnyNode } from '../../test/helpers.js'

describe('function-max-returns examples', () => {
  describe('typescript', () => {
    const valid = [
      {
        description: 'single return',
        code: `function add(a: number, b: number) {\n  return a + b\n}`,
      },
      {
        description: 'multiple returns within limit',
        code: `function check(x: number) {\n  if (x > 0) return 1\n  if (x < 0) return -1\n  return 0\n}`,
      },
      {
        description: 'function at exactly max returns',
        code: `function classify(x: number) {\n  if (x > 10) return 'high'\n  if (x > 5) return 'medium'\n  return 'low'\n}`,
      },
    ]

    const invalid = [
      {
        description: 'function exceeding max returns',
        code: [
          'function manyPaths(x: number) {',
          '  if (x === 1) return "one"',
          '  if (x === 2) return "two"',
          '  if (x === 3) return "three"',
          '  if (x === 4) return "four"',
          '  if (x === 5) return "five"',
          '  return "other"',
          '}',
        ].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-returns', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-returns', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })

    it('reports correct return count in violation message', async () => {
      const rule = getBuiltinRule('function-max-returns', { max: 3 })
      const code = [
        'function manyPaths(x: number) {',
        '  if (x === 1) return "one"',
        '  if (x === 2) return "two"',
        '  if (x === 3) return "three"',
        '  if (x === 4) return "four"',
        '  if (x === 5) return "five"',
        '  return "other"',
        '}',
      ].join('\n')
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('6 return statements')
      expect(violations[0]).toContain('max: 3')
    })

    it('does not count returns in nested callbacks', async () => {
      const rule = getBuiltinRule('function-max-returns', { max: 5 })
      const code = [
        'function process(items: number[]) {',
        '  if (!items.length) return []',
        '  return items.map(x => {',
        '    if (x > 0) return x',
        '    if (x < 0) return -x',
        '    return 0',
        '  })',
        '}',
      ].join('\n')
      // outer function has 2 returns, inner callback has 3 — both under max 5
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })
  })

  describe('javascript', () => {
    const valid = [
      {
        description: 'single return',
        code: `function add(a, b) {\n  return a + b\n}`,
      },
    ]

    const invalid = [
      {
        description: 'function exceeding max returns',
        code: [
          'function manyPaths(x) {',
          '  if (x === 1) return "one"',
          '  if (x === 2) return "two"',
          '  if (x === 3) return "three"',
          '  if (x === 4) return "four"',
          '  return "other"',
          '}',
        ].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-returns', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-returns', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(true)
    })
  })

  describe('python', () => {
    const valid = [
      {
        description: 'single return',
        code: `def add(a, b):\n    return a + b`,
      },
      {
        description: 'multiple returns within limit',
        code: `def check(x):\n    if x > 0:\n        return 1\n    if x < 0:\n        return -1\n    return 0`,
      },
    ]

    const invalid = [
      {
        description: 'function exceeding max returns',
        code: [
          'def many_paths(x):',
          '    if x == 1: return "one"',
          '    if x == 2: return "two"',
          '    if x == 3: return "three"',
          '    if x == 4: return "four"',
          '    if x == 5: return "five"',
          '    return "other"',
        ].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-returns', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-returns', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(true)
    })
  })

  describe('java', () => {
    const valid = [
      {
        description: 'single return',
        code: `class Foo { int add(int a, int b) { return a + b; } }`,
      },
    ]

    const invalid = [
      {
        description: 'method exceeding max returns',
        code: [
          'class Foo {',
          '  String manyPaths(int x) {',
          '    if (x == 1) return "one";',
          '    if (x == 2) return "two";',
          '    if (x == 3) return "three";',
          '    if (x == 4) return "four";',
          '    if (x == 5) return "five";',
          '    return "other";',
          '  }',
          '}',
        ].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-returns', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-returns', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(true)
    })
  })

  describe('kotlin', () => {
    const valid = [
      {
        description: 'single return',
        code: `fun add(a: Int, b: Int): Int = a + b`,
      },
    ]

    const invalid = [
      {
        description: 'function exceeding max returns',
        code: [
          'fun manyPaths(x: Int): String {',
          '  if (x == 1) return "one"',
          '  if (x == 2) return "two"',
          '  if (x == 3) return "three"',
          '  if (x == 4) return "four"',
          '  if (x == 5) return "five"',
          '  return "other"',
          '}',
        ].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-returns', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-returns', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('uses correct default severity', () => {
      const rule = getBuiltinRule('function-max-returns')
      expect(rule.severity).toBe('error')
    })
  })
})