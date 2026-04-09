import { describe, it, expect } from 'vitest'
import { makeNode, makeContext } from '../../test/fixtures.js'
import { RuleRegistry } from '../registry.js'
import { validateConfig } from '../../config/validation.js'
import registerFunctionComplexity from './function-complexity.js'

function getRule(config: Record<string, any> = {}) {
  const registry = new RuleRegistry()
  registerFunctionComplexity(registry)
  const [{ id, schema, create }] = registry.getEntries()
  return { id, ...create(validateConfig(id, schema, config)) }
}

function makeFunction(language: string, branchTypes: string[] = []) {
  const children = branchTypes.map((type) => makeNode(type))
  return makeNode('function_declaration', {
    childCount: children.length,
    child: (i: number) => children[i],
  })
}

describe('function-max-complexity', () => {
  it('has correct id', () => {
    expect(getRule().id).toBe('function-max-complexity')
  })

  it('defaults to error severity', () => {
    expect(getRule().severity).toBe('error')
  })

  it('uses custom severity from config', () => {
    expect(getRule({ severity: 'warning' }).severity).toBe('warning')
  })

  it('returns false for non-function nodes', () => {
    const rule = getRule({ max: 1 })
    const ctx = makeContext('typescript')
    const node = makeNode('if_statement')
    expect(rule.match(node, ctx)).toBe(false)
  })

  it('returns false when complexity is within default limit', () => {
    const rule = getRule()
    const ctx = makeContext('typescript')
    // complexity 1 (no branches)
    expect(rule.match(makeFunction('typescript'), ctx)).toBe(false)
  })

  it('returns false when complexity equals max', () => {
    const rule = getRule({ max: 3 })
    const ctx = makeContext('typescript')
    // complexity = 1 + 2 branches = 3
    expect(rule.match(makeFunction('typescript', ['if_statement', 'for_statement']), ctx)).toBe(false)
  })

  it('returns true when complexity exceeds max', () => {
    const rule = getRule({ max: 3 })
    const ctx = makeContext('typescript')
    // complexity = 1 + 3 branches = 4
    expect(rule.match(makeFunction('typescript', ['if_statement', 'for_statement', 'while_statement']), ctx)).toBe(true)
  })

  it('uses custom max from config', () => {
    const rule = getRule({ max: 1 })
    const ctx = makeContext('typescript')
    expect(rule.match(makeFunction('typescript', ['if_statement']), ctx)).toBe(true)
  })

  it('returns false for unsupported language', () => {
    const rule = getRule({ max: 1 })
    const ctx = makeContext('ruby')
    expect(rule.match(makeFunction('ruby', ['if_statement']), ctx)).toBe(false)
  })

  it('counts branches for python language', () => {
    const rule = getRule({ max: 2 })
    const fnNode = makeNode('function_definition', {
      childCount: 2,
      child: (i: number) => makeNode(['if_statement', 'for_statement'][i]),
    })
    const ctx = makeContext('python')
    // complexity = 1 + 2 = 3 > 2
    expect(rule.match(fnNode, ctx)).toBe(true)
  })
})