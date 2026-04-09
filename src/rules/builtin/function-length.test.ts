import { describe, it, expect } from 'vitest'
import { makeNode, makeContext } from '../../test/fixtures.js'
import { RuleRegistry } from '../registry.js'
import { validateConfig } from '../../config/validation.js'
import registerFunctionLength from './function-length.js'

function getRule(config: Record<string, any> = {}) {
  const registry = new RuleRegistry()
  registerFunctionLength(registry)
  const [{ id, schema, create }] = registry.getEntries()
  return { id, ...create(validateConfig(id, schema, config)) }
}

function makeFunction(type: string, startRow: number, endRow: number) {
  return makeNode(type, { startPosition: { row: startRow, column: 0 }, endPosition: { row: endRow, column: 1 } })
}

describe('function-max-lines', () => {
  it('has correct id', () => {
    expect(getRule().id).toBe('function-max-lines')
  })

  it('uses default max of 60', () => {
    const rule = getRule()
    const ctx = makeContext('typescript')
    expect(rule.match(makeFunction('function_declaration', 0, 59), ctx)).toBe(false)
    expect(rule.match(makeFunction('function_declaration', 0, 60), ctx)).toBe(true)
  })

  it('uses custom max from config', () => {
    const rule = getRule({ max: 10 })
    const ctx = makeContext('typescript')
    expect(rule.match(makeFunction('function_declaration', 0, 9), ctx)).toBe(false)
    expect(rule.match(makeFunction('function_declaration', 0, 10), ctx)).toBe(true)
  })

  it('uses custom severity from config', () => {
    expect(getRule({ severity: 'warning' }).severity).toBe('warning')
  })

  it('defaults to error severity', () => {
    expect(getRule().severity).toBe('error')
  })

  it.each([
    'function_declaration',
    'function_definition',
    'arrow_function',
    'method_declaration',
  ])('matches %s node type', (type) => {
    const rule = getRule({ max: 5 })
    const ctx = makeContext('typescript')
    expect(rule.match(makeFunction(type, 0, 10), ctx)).toBe(true)
  })

  it('ignores non-function nodes', () => {
    const rule = getRule({ max: 5 })
    const ctx = makeContext('typescript')
    expect(rule.match(makeFunction('if_statement', 0, 100), ctx)).toBe(false)
  })
})