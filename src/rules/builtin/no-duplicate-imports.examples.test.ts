import { describe, expect, it } from 'vitest'
import { collectViolations, getBuiltinRule, matchesAnyNode } from '../../test/helpers.js'

describe('no-duplicate-imports examples', () => {
  describe('typescript', () => {
    const valid = [
      {
        description: 'distinct import sources',
        code: `import { Foo } from 'react'\nimport { Bar } from 'lodash'`,
      },
      {
        description: 'single import',
        code: `import { useState } from 'react'`,
      },
    ]

    const invalid = [
      {
        description: 'duplicate imports from same source',
        code: `import { Foo } from 'react'\nimport { Bar } from 'react'`,
      },
      {
        description: 'three imports from same source',
        code: `import { A } from 'utils'\nimport { B } from 'utils'\nimport { C } from 'utils'`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-duplicate-imports')
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations).toHaveLength(0)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-duplicate-imports')
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations.length).toBeGreaterThan(0)
    })

    it('reports correct source in message', async () => {
      const rule = getBuiltinRule('no-duplicate-imports')
      const violations = await collectViolations(
        rule,
        `import { Foo } from 'react'\nimport { Bar } from 'react'`,
        'typescript'
      )
      expect(violations[0]).toContain("'react'")
    })

    it('reports one violation per duplicate (2 duplicates = 1 violation)', async () => {
      const rule = getBuiltinRule('no-duplicate-imports')
      const violations = await collectViolations(
        rule,
        `import { Foo } from 'react'\nimport { Bar } from 'react'`,
        'typescript'
      )
      expect(violations).toHaveLength(1)
    })

    it('reports two violations for three imports from same source', async () => {
      const rule = getBuiltinRule('no-duplicate-imports')
      const violations = await collectViolations(
        rule,
        `import { A } from 'utils'\nimport { B } from 'utils'\nimport { C } from 'utils'`,
        'typescript'
      )
      expect(violations).toHaveLength(2)
    })
  })

  describe('javascript', () => {
    const valid = [
      {
        description: 'distinct import sources',
        code: `import { Foo } from 'react'\nimport { Bar } from 'lodash'`,
      },
    ]

    const invalid = [
      {
        description: 'duplicate imports from same source',
        code: `import { Foo } from 'react'\nimport { Bar } from 'react'`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-duplicate-imports')
      const violations = await collectViolations(rule, code, 'javascript')
      expect(violations).toHaveLength(0)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-duplicate-imports')
      const violations = await collectViolations(rule, code, 'javascript')
      expect(violations.length).toBeGreaterThan(0)
    })
  })

  describe('python', () => {
    const valid = [
      {
        description: 'distinct imports',
        code: `import os\nfrom sys import path`,
      },
    ]

    const invalid = [
      {
        description: 'duplicate import',
        code: `import os\nimport os`,
      },
      {
        description: 'duplicate from-import',
        code: `from sys import path\nfrom sys import argv`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-duplicate-imports')
      const violations = await collectViolations(rule, code, 'python')
      expect(violations).toHaveLength(0)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-duplicate-imports')
      const violations = await collectViolations(rule, code, 'python')
      expect(violations.length).toBeGreaterThan(0)
    })

    it('reports correct module in message', async () => {
      const rule = getBuiltinRule('no-duplicate-imports')
      const violations = await collectViolations(rule, `import os\nimport os`, 'python')
      expect(violations[0]).toContain('os')
    })
  })

  describe('java', () => {
    const valid = [
      {
        description: 'distinct imports',
        code: `import java.util.List;\nimport java.util.ArrayList;`,
      },
    ]

    const invalid = [
      {
        description: 'duplicate import',
        code: `import java.util.List;\nimport java.util.List;`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-duplicate-imports')
      const violations = await collectViolations(rule, code, 'java')
      expect(violations).toHaveLength(0)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-duplicate-imports')
      const violations = await collectViolations(rule, code, 'java')
      expect(violations.length).toBeGreaterThan(0)
    })

    it('reports correct module in message', async () => {
      const rule = getBuiltinRule('no-duplicate-imports')
      const violations = await collectViolations(rule, `import java.util.List;\nimport java.util.List;`, 'java')
      expect(violations[0]).toContain('java.util.List')
    })
  })

  describe('kotlin', () => {
    const valid = [
      {
        description: 'distinct imports',
        code: `import java.util.List\nimport java.util.ArrayList`,
      },
    ]

    const invalid = [
      {
        description: 'duplicate import',
        code: `import java.util.List\nimport java.util.List`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-duplicate-imports')
      const violations = await collectViolations(rule, code, 'kotlin')
      expect(violations).toHaveLength(0)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-duplicate-imports')
      const violations = await collectViolations(rule, code, 'kotlin')
      expect(violations.length).toBeGreaterThan(0)
    })

    it('reports correct module in message', async () => {
      const rule = getBuiltinRule('no-duplicate-imports')
      const violations = await collectViolations(rule, `import java.util.List\nimport java.util.List`, 'kotlin')
      expect(violations[0]).toContain('java.util.List')
    })
  })

  describe('edge cases', () => {
    it('uses correct default severity', () => {
      const rule = getBuiltinRule('no-duplicate-imports')
      expect(rule.severity).toBe('error')
    })
  })
})
