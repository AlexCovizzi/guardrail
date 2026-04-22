import { describe, expect, it } from 'vitest'
import { collectViolations, getBuiltinRule, matchesAnyNode } from '../../test/helpers.js'

function makeImports(n: number, lang: string): string {
  if (lang === 'python') {
    return Array.from({ length: n }, (_, i) => `import module${i + 1}`).join('\n')
  }
  if (lang === 'java' || lang === 'kotlin') {
    return Array.from({ length: n }, (_, i) => `import com.pkg${i + 1}.Module${i + 1};`).join('\n')
  }
  return Array.from({ length: n }, (_, i) => `import { mod${i + 1} } from 'module${i + 1}'`).join('\n')
}

describe('max-import-lines examples', () => {
  describe('typescript', () => {
    const valid = [
      {
        description: 'few import lines',
        code: makeImports(3, 'typescript') + '\n\nconst x = 1',
      },
      {
        description: 'import section at exactly max lines',
        code: makeImports(5, 'typescript') + '\n\nconst x = 1',
      },
    ]

    const invalid = [
      {
        description: 'import section exceeding max lines',
        code: makeImports(8, 'typescript') + '\n\nconst x = 1',
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('max-import-lines', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('max-import-lines', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })

    it('reports correct line count in violation message', async () => {
      const rule = getBuiltinRule('max-import-lines', { max: 5 })
      const code = makeImports(8, 'typescript') + '\n\nconst x = 1'
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('8 lines')
      expect(violations[0]).toContain('max: 5')
    })

    it('does not flag when there are no imports', async () => {
      const rule = getBuiltinRule('max-import-lines', { max: 5 })
      const code = 'const x = 1'
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })
  })

  describe('javascript', () => {
    const valid = [
      {
        description: 'few import lines',
        code: makeImports(3, 'javascript') + '\n\nconst x = 1',
      },
    ]

    const invalid = [
      {
        description: 'import section exceeding max lines',
        code: makeImports(8, 'javascript') + '\n\nconst x = 1',
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('max-import-lines', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('max-import-lines', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(true)
    })
  })

  describe('python', () => {
    const valid = [
      {
        description: 'few import lines',
        code: makeImports(3, 'python') + '\n\nx = 1',
      },
    ]

    const invalid = [
      {
        description: 'import section exceeding max lines',
        code: makeImports(8, 'python') + '\n\nx = 1',
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('max-import-lines', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('max-import-lines', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(true)
    })
  })

  describe('java', () => {
    const valid = [
      {
        description: 'few import lines',
        code: makeImports(3, 'java') + '\n\nclass Foo {}',
      },
    ]

    const invalid = [
      {
        description: 'import section exceeding max lines',
        code: makeImports(8, 'java') + '\n\nclass Foo {}',
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('max-import-lines', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('max-import-lines', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(true)
    })
  })

  describe('kotlin', () => {
    const valid = [
      {
        description: 'few import lines',
        code: makeImports(3, 'kotlin') + '\n\nfun main() {}',
      },
    ]

    const invalid = [
      {
        description: 'import section exceeding max lines',
        code: makeImports(8, 'kotlin') + '\n\nfun main() {}',
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('max-import-lines', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('max-import-lines', { max: 5 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('uses correct default severity', () => {
      const rule = getBuiltinRule('max-import-lines')
      expect(rule.severity).toBe('warning')
    })
  })
})