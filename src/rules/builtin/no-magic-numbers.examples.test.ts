import { describe, expect, it } from 'vitest'
import { collectViolations, getBuiltinRule, matchesAnyNode } from '../../test/helpers.js'

describe('no-magic-numbers examples', () => {
  describe('typescript', () => {
    const valid = [
      {
        description: 'named constant',
        code: `const MAX_RETRIES = 3`,
      },
      {
        description: 'common values 0 and 1 ignored by default',
        code: `function getFirst(arr: any[]) { return arr[0] }`,
      },
      {
        description: 'enum member value',
        code: `enum Status { Active = 1, Inactive = 0 }`,
      },
    ]

    const invalid = [
      {
        description: 'magic number in function body',
        code: `function delay() { setTimeout(() => {}, 86400) }`,
      },
      {
        description: 'magic number in comparison',
        code: `function isAdult(age: number) { return age >= 18 }`,
      },
      {
        description: 'magic number 42',
        code: `function getAnswer() { return 42 }`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-magic-numbers')
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-magic-numbers')
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })
  })

  describe('javascript', () => {
    const valid = [
      {
        description: 'named constant',
        code: `const MAX_SIZE = 100`,
      },
    ]

    const invalid = [
      {
        description: 'magic number in function',
        code: `function calc() { return 3600 * 24 }`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-magic-numbers')
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-magic-numbers')
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(true)
    })
  })

  describe('python', () => {
    const valid = [
      {
        description: 'named constant at module level',
        code: `MAX_RETRIES = 3`,
      },
    ]

    const invalid = [
      {
        description: 'magic number in function',
        code: `def get_timeout():\n    return 86400`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-magic-numbers')
      expect(await matchesAnyNode(rule, code, 'python')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-magic-numbers')
      expect(await matchesAnyNode(rule, code, 'python')).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('ignores custom values from config', async () => {
      const rule = getBuiltinRule('no-magic-numbers', { ignore: '0,1,-1,42' })
      const code = `function getAnswer() { return 42 }`
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it('reports the magic number value in the message', async () => {
      const rule = getBuiltinRule('no-magic-numbers')
      const code = `function getAnswer() { return 42 }`
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0]).toContain('42')
    })

    it('does not flag numbers in const declarations', async () => {
      const rule = getBuiltinRule('no-magic-numbers')
      const code = `const SECONDS_PER_DAY = 86400`
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it('uses correct default severity', () => {
      const rule = getBuiltinRule('no-magic-numbers')
      expect(rule.severity).toBe('warning')
    })
  })
})
