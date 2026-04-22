import { describe, expect, it } from 'vitest'
import { collectViolations, getBuiltinRule, matchesAnyNode } from '../../test/helpers.js'

describe('function-max-locals examples', () => {
  describe('typescript', () => {
    const valid = [
      {
        description: 'function with few locals',
        code: `function add(a: number, b: number) {\n  const sum = a + b\n  return sum\n}`,
      },
      {
        description: 'function at exactly max locals',
        code: [
          'function atLimit() {',
          '  const a = 1',
          '  const b = 2',
          '  const c = 3',
          '  return a + b + c',
          '}',
        ].join('\n'),
      },
    ]

    const invalid = [
      {
        description: 'function exceeding max locals',
        code: [
          'function tooMany() {',
          '  const a = 1',
          '  const b = 2',
          '  const c = 3',
          '  const d = 4',
          '  const e = 5',
          '  const f = 6',
          '  return a + b + c + d + e + f',
          '}',
        ].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-locals', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-locals', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })

    it('reports correct local count in violation message', async () => {
      const rule = getBuiltinRule('function-max-locals', { max: 3 })
      const code = [
        'function tooMany() {',
        '  const a = 1',
        '  const b = 2',
        '  const c = 3',
        '  const d = 4',
        '  const e = 5',
        '  const f = 6',
        '  return a + b + c + d + e + f',
        '}',
      ].join('\n')
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('6 local variables')
      expect(violations[0]).toContain('max: 3')
    })

    it('counts each declarator in a multi-declaration', async () => {
      const rule = getBuiltinRule('function-max-locals', { max: 3 })
      const code = [
        'function multi() {',
        '  const a = 1, b = 2, c = 3',
        '  const d = 4',
        '  return a + b + c + d',
        '}',
      ].join('\n')
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('4 local variables')
    })

    it('does not count locals in nested functions', async () => {
      const rule = getBuiltinRule('function-max-locals', { max: 2 })
      const code = [
        'function outer() {',
        '  const a = 1',
        '  const inner = () => {',
        '    const x = 1',
        '    const y = 2',
        '    const z = 3',
        '    return x + y + z',
        '  }',
        '  return a + inner()',
        '}',
      ].join('\n')
      // outer has 2 locals (a, inner), inner has 3 locals (x, y, z) — both checked separately
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })
  })

  describe('javascript', () => {
    const valid = [
      {
        description: 'function with few locals',
        code: `function add(a, b) {\n  var sum = a + b\n  return sum\n}`,
      },
    ]

    const invalid = [
      {
        description: 'function exceeding max locals',
        code: [
          'function tooMany() {',
          '  var a = 1',
          '  var b = 2',
          '  var c = 3',
          '  var d = 4',
          '  var e = 5',
          '  return a + b + c + d + e',
          '}',
        ].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-locals', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-locals', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(true)
    })
  })

  describe('python', () => {
    const valid = [
      {
        description: 'function with few locals',
        code: `def add(a, b):\n    result = a + b\n    return result`,
      },
    ]

    const invalid = [
      {
        description: 'function exceeding max locals',
        code: [
          'def too_many():',
          '    a = 1',
          '    b = 2',
          '    c = 3',
          '    d = 4',
          '    e = 5',
          '    return a + b + c + d + e',
        ].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-locals', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-locals', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(true)
    })
  })

  describe('java', () => {
    const valid = [
      {
        description: 'method with few locals',
        code: `class Foo { int add(int a, int b) { int sum = a + b; return sum; } }`,
      },
    ]

    const invalid = [
      {
        description: 'method exceeding max locals',
        code: [
          'class Foo {',
          '  int tooMany() {',
          '    int a = 1;',
          '    int b = 2;',
          '    int c = 3;',
          '    int d = 4;',
          '    int e = 5;',
          '    return a + b + c + d + e;',
          '  }',
          '}',
        ].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-locals', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-locals', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(true)
    })
  })

  describe('kotlin', () => {
    const valid = [
      {
        description: 'function with few locals',
        code: `fun add(a: Int, b: Int): Int {\n  val sum = a + b\n  return sum\n}`,
      },
    ]

    const invalid = [
      {
        description: 'function exceeding max locals',
        code: [
          'fun tooMany(): Int {',
          '  val a = 1',
          '  val b = 2',
          '  val c = 3',
          '  val d = 4',
          '  val e = 5',
          '  return a + b + c + d + e',
          '}',
        ].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-locals', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-locals', { max: 3 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('uses correct default severity', () => {
      const rule = getBuiltinRule('function-max-locals')
      expect(rule.severity).toBe('error')
    })
  })
})