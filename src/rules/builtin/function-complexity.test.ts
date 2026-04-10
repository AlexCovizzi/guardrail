import { describe, it, expect, vi } from 'vitest'
import { makeNode, makeContext } from '../../test/fixtures.js'
import { RuleRegistry } from '../registry.js'
import { ConfigBuilderImpl } from '../../config/builder.js'
import { RuleContext } from '../../core/types.js'
import { SemanticTypeName } from '../../core/languages.js'
import registerFunctionComplexity from './function-complexity.js'

function getRule(config: Record<string, any> = {}) {
  const registry = new RuleRegistry()
  registerFunctionComplexity(registry)
  const [{ id, definition }] = registry.getEntries()
  const builder = new ConfigBuilderImpl(id, config)
  const visitors = definition.create(builder)
  const severity = config.severity ?? definition.defaultSeverity ?? 'error'
  return { id, description: definition.description, severity, visitors }
}

function callVisitor(rule: ReturnType<typeof getRule>, node: any, ctx: any, report: any) {
  const ruleCtx: RuleContext = { ...ctx, report }
  for (const [key, fn] of Object.entries(rule.visitors)) {
    if (fn == null) continue
    const k = key.endsWith('Exit') ? key.slice(0, -4) : key
    if (k.startsWith('_')) {
      const nodeType = k.slice(1).replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
      if (nodeType === node.type) fn(node, ruleCtx)
    } else if (k in ctx.language.types) {
      const langTypes = ctx.language.types[k as SemanticTypeName]
      if (langTypes.includes(node.type)) fn(node, ruleCtx)
    }
  }
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

  it('does not report for non-function nodes', () => {
    const rule = getRule({ max: 1 })
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(rule, makeNode('if_statement'), ctx, report)
    expect(report).not.toHaveBeenCalled()
  })

  it('does not report when complexity is within default limit', () => {
    const rule = getRule()
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(rule, makeFunction('typescript'), ctx, report)
    expect(report).not.toHaveBeenCalled()
  })

  it('does not report when complexity equals max', () => {
    const rule = getRule({ max: 3 })
    const ctx = makeContext('typescript')
    const report = vi.fn()
    // complexity = 1 + 2 branches = 3
    callVisitor(rule, makeFunction('typescript', ['if_statement', 'for_statement']), ctx, report)
    expect(report).not.toHaveBeenCalled()
  })

  it('reports when complexity exceeds max', () => {
    const rule = getRule({ max: 3 })
    const ctx = makeContext('typescript')
    const report = vi.fn()
    // complexity = 1 + 3 branches = 4
    callVisitor(rule, makeFunction('typescript', ['if_statement', 'for_statement', 'while_statement']), ctx, report)
    expect(report).toHaveBeenCalledOnce()
  })

  it('uses custom max from config', () => {
    const rule = getRule({ max: 1 })
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(rule, makeFunction('typescript', ['if_statement']), ctx, report)
    expect(report).toHaveBeenCalledOnce()
  })

  it('does not report for unsupported language', () => {
    const rule = getRule({ max: 1 })
    const ctx = makeContext('ruby')
    const report = vi.fn()
    callVisitor(rule, makeFunction('ruby', ['if_statement']), ctx, report)
    expect(report).not.toHaveBeenCalled()
  })

  it('counts branches for python language', () => {
    const rule = getRule({ max: 2 })
    const fnNode = makeNode('function_definition', {
      childCount: 2,
      child: (i: number) => makeNode(['if_statement', 'for_statement'][i]),
    })
    const ctx = makeContext('python')
    const report = vi.fn()
    // complexity = 1 + 2 = 3 > 2
    callVisitor(rule, fnNode, ctx, report)
    expect(report).toHaveBeenCalledOnce()
  })

  it('includes actual and max complexity in message', () => {
    const rule = getRule({ max: 1 })
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(rule, makeFunction('typescript', ['if_statement']), ctx, report)
    expect(report).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('2'),
    }))
    expect(report).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('1'),
    }))
  })
})
