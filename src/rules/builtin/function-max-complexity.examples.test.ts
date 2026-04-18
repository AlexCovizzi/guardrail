import { describe, expect, it } from 'vitest'
import { collectViolations, getBuiltinRule, matchesAnyNode } from '../../test/helpers.js'

describe('function-max-complexity examples', () => {
  describe('typescript', () => {
    const valid = [
      {
        description: 'simple function with no branches',
        code: `function add(a: number, b: number): number { return a + b }`,
      },
      {
        description: 'function with one if branch (complexity 2)',
        code: `function abs(n: number): number { if (n < 0) return -n; return n }`,
      },
      {
        description: 'function at exactly max complexity',
        code: `function check(a: boolean, b: boolean): void { if (a) { return } if (b) { return } return }`,
      },
    ]

    const invalid = [
      {
        description: 'function with many branches',
        code: `
          function classify(n: number): string {
            if (n < 0) {
              return "negative"
            } else if (n === 0) {
              return "zero"
            } else if (n < 10) {
              return "small"
            } else if (n < 100) {
              return "medium"
            } else {
              return "large"
            }
          }
        `,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-complexity', { max: 4 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-complexity', { max: 4 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })

    it('reports correct complexity in violation message', async () => {
      const rule = getBuiltinRule('function-max-complexity', { max: 4 })
      const code = `
        function classify(n: number): string {
          if (n < 0) {
            return "negative"
          } else if (n === 0) {
            return "zero"
          } else if (n < 10) {
            return "small"
          } else if (n < 100) {
            return "medium"
          } else {
            return "large"
          }
        }
      `
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0]).toContain('cyclomatic complexity')
      expect(violations[0]).toContain('max: 4')
    })
  })

  describe('javascript', () => {
    const valid = [
      {
        description: 'simple function with no branches',
        code: `function add(a, b) { return a + b }`,
      },
    ]

    const invalid = [
      {
        description: 'function with many branches',
        code: `
function classify(n) {
  if (n < 0) {
    return "negative"
  } else if (n === 0) {
    return "zero"
  } else if (n < 10) {
    return "small"
  } else if (n < 100) {
    return "medium"
  } else {
    return "large"
  }
}
        `,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-complexity', { max: 4 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-complexity', { max: 4 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(true)
    })
  })

  describe('python', () => {
    const valid = [
      {
        description: 'simple function',
        code: `def add(a, b):\n    return a + b`,
      },
    ]

    const invalid = [
      {
        description: 'function with many branches',
        code: `
def classify(n):
    if n < 0:
        return "negative"
    elif n == 0:
        return "zero"
    elif n < 10:
        return "small"
    elif n < 100:
        return "medium"
    else:
        return "large"
        `,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-complexity', { max: 4 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-complexity', { max: 4 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(true)
    })
  })

  describe('java', () => {
    const valid = [
      {
        description: 'simple method with no branches',
        code: `class Foo { int add(int a, int b) { return a + b; } }`,
      },
    ]

    const invalid = [
      {
        description: 'method with many branches',
        code: [
          'class Foo {',
          '  String classify(int n) {',
          '    if (n < 0) {',
          '      return "negative";',
          '    } else if (n == 0) {',
          '      return "zero";',
          '    } else if (n < 10) {',
          '      return "small";',
          '    } else if (n < 100) {',
          '      return "medium";',
          '    } else {',
          '      return "large";',
          '    }',
          '  }',
          '}',
        ].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-complexity', { max: 4 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-complexity', { max: 4 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(true)
    })
  })

  describe('kotlin', () => {
    const valid = [
      {
        description: 'simple function with no branches',
        code: `fun add(a: Int, b: Int): Int = a + b`,
      },
    ]

    const invalid = [
      {
        description: 'function with many branches',
        code: [
          'fun classify(n: Int): String {',
          '  if (n < 0) return "negative"',
          '  else if (n == 0) return "zero"',
          '  else if (n < 10) return "small"',
          '  else if (n < 100) return "medium"',
          '  else return "large"',
          '}',
        ].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-complexity', { max: 4 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-complexity', { max: 4 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('uses correct default severity', () => {
      const rule = getBuiltinRule('function-max-complexity')
      expect(rule.severity).toBe('error')
    })
  })
})
