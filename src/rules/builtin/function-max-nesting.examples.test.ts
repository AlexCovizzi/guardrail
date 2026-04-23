import { describe, expect, it } from 'vitest'
import { collectViolations, getBuiltinRule, matchesAnyNode } from '../../test/helpers.js'

describe('function-max-nesting examples', () => {
  describe('typescript', () => {
    const valid = [
      {
        description: 'flat function',
        code: `function add(a: number, b: number) {\n  return a + b\n}`,
      },
      {
        description: 'shallow nesting within limit',
        code: `function check(x: number) {\n  if (x > 0) {\n    if (x > 10) {\n      console.log(x)\n    }\n  }\n}`,
      },
      {
        description: 'nesting at exactly max depth',
        code: `function atLimit(x: number) {\n  if (x > 0) {\n    if (x > 10) {\n      console.log(x)\n    }\n  }\n}`,
      },
      {
        description: 'callback within nesting limit',
        code: `function process(data: number[]) {\n  return data.filter(x => x > 0)\n}`,
      },
      {
        description: 'nested callback with branch within limit',
        code: `function process(data: number[]) {\n  return data.filter(x => {\n    if (x > 0) {\n      return true\n    }\n    return false\n  })\n}`,
      },
    ]

    const invalid = [
      {
        description: 'deeply nested if chains exceeding limit',
        code: [
          'function deep(x: number) {',
          '  if (x > 0) {',
          '    if (x > 1) {',
          '      if (x > 2) {',
          '        if (x > 3) {',
          '          if (x > 4) {',
          '            console.log(x)',
          '          }',
          '        }',
          '      }',
          '    }',
          '  }',
          '}',
        ].join('\n'),
      },
      {
        description: 'function is nested deep enough to exceed limit',
        code: [
          'function outer() {',
          '  if (a) {',
          '    if (b) {',
          '      if (c) {',
          '        return data.map(x => {',
          '          return x',
          '        })',
          '      }',
          '    }',
          '  }',
          '}',
        ].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-nesting', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-nesting', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })

    it('reports correct nesting depth in violation message', async () => {
      const rule = getBuiltinRule('function-max-nesting', { max: 3 })
      const code = [
        'function deep(x: number) {',
        '  if (x > 0) {',
        '    if (x > 1) {',
        '      if (x > 2) {',
        '        if (x > 3) {',
        '          if (x > 4) {',
        '            console.log(x)',
        '          }',
        '        }',
        '      }',
        '    }',
        '  }',
        '}',
      ].join('\n')
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0]).toContain('nesting depth')
      expect(violations[0]).toContain('max: 3')
    })
  })

  describe('javascript', () => {
    const valid = [
      {
        description: 'flat function',
        code: `function add(a, b) {\n  return a + b\n}`,
      },
    ]

    const invalid = [
      {
        description: 'deeply nested if chains exceeding limit',
        code: [
          'function deep(x) {',
          '  if (x > 0) {',
          '    if (x > 1) {',
          '      if (x > 2) {',
          '        if (x > 3) {',
          '          console.log(x)',
          '        }',
          '      }',
          '    }',
          '  }',
          '}',
        ].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-nesting', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-nesting', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(true)
    })
  })

  describe('python', () => {
    const valid = [
      {
        description: 'flat function',
        code: `def add(a, b):\n    return a + b`,
      },
      {
        description: 'shallow nesting within limit',
        code: `def check(x):\n    if x > 0:\n        if x > 10:\n            print(x)`,
      },
    ]

    const invalid = [
      {
        description: 'deeply nested if chains exceeding limit',
        code: [
          'def deep(x):',
          '    if x > 0:',
          '        if x > 1:',
          '            if x > 2:',
          '                if x > 3:',
          '                    if x > 4:',
          '                        print(x)',
        ].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-nesting', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-nesting', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(true)
    })
  })

  describe('java', () => {
    const valid = [
      {
        description: 'flat method',
        code: `class Foo { int add(int a, int b) { return a + b; } }`,
      },
    ]

    const invalid = [
      {
        description: 'deeply nested method exceeding limit',
        code: [
          'class Foo {',
          '  void deep(int x) {',
          '    if (x > 0) {',
          '      if (x > 1) {',
          '        if (x > 2) {',
          '          if (x > 3) {',
          '            System.out.println(x);',
          '          }',
          '        }',
          '      }',
          '    }',
          '  }',
          '}',
        ].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-nesting', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-nesting', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(true)
    })
  })

  describe('kotlin', () => {
    const valid = [
      {
        description: 'flat function',
        code: `fun add(a: Int, b: Int): Int = a + b`,
      },
    ]

    const invalid = [
      {
        description: 'deeply nested function exceeding limit',
        code: [
          'fun deep(x: Int): Unit {',
          '  if (x > 0) {',
          '    if (x > 1) {',
          '      if (x > 2) {',
          '        if (x > 3) {',
          '          println(x)',
          '        }',
          '      }',
          '    }',
          '  }',
          '}',
        ].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-nesting', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-nesting', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(true)
    })
  })

  describe('flat handlers — fire across all depths', () => {
    it('function and branch handlers fire at every nesting level', async () => {
      const rule = getBuiltinRule('function-max-nesting', { max: 1 })
      const code = [
        'function outer() {',
        '  if (x) {',
        '    function middle() {',
        '      if (y) {',
        '        function inner() {',
        '          if (z) {}',
        '        }',
        '      }',
        '    }',
        '  }',
        '}',
      ].join('\n')
      // outer has nesting depth 2 (branch + nested function), middle has 2
      // inner has depth 1 (within limit). Only outer and middle violated max 1.
      const violations = await collectViolations(rule, code, 'javascript')
      expect(violations.length).toBe(2)
    })
  })

  describe('edge cases', () => {
    it('uses correct default severity', () => {
      const rule = getBuiltinRule('function-max-nesting')
      expect(rule.severity).toBe('error')
    })
  })
})
