import { describe, expect, it, vi } from 'vitest'
import { RuleConfig } from '../../config/rule-config.js'
import type { SemanticTypeName } from '../../core/languages.js'
import type { Handler } from '../rule.js'
import { makeContext, makeNode } from '../../test/fixtures.js'
import { RuleRegistry } from '../registry.js'
import registerFunctionParameterCount from './function-parameter-count.js'

function getRule(config: Record<string, any> = {}) {
  const registry = new RuleRegistry()
  registerFunctionParameterCount(registry.register.bind(registry))
  const [{ ruleId, definition }] = registry.getEntries()
  const builder = new RuleConfig(ruleId, config)
  const visitors = definition.create(builder)
  const severity = config.severity ?? definition.defaultSeverity ?? 'error'
  return { id: ruleId, description: definition.description, severity, visitors }
}

function callVisitor(rule: ReturnType<typeof getRule>, node: any, ctx: any, report: any) {
  const ruleCtx = ctx
  for (const [key, fn] of Object.entries(rule.visitors) as [string, Handler][]) {
    if (fn == null) continue
    const k = key.endsWith('Exit') ? key.slice(0, -4) : key
    if (k.startsWith('_')) {
      const nodeType = k.slice(1).replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
      if (nodeType === node.type) fn(node, ruleCtx, report)
    } else if (k in ctx.language.types) {
      const langTypes = ctx.language.types[k as SemanticTypeName]
      if (langTypes.includes(node.type)) fn(node, ruleCtx, report)
    }
  }
}

function makeFunction(type: string, paramCount: number, paramNodeType = 'formal_parameters') {
  const paramsNode = makeNode(paramNodeType, { namedChildCount: paramCount })
  return makeNode(type, {
    childCount: 1,
    child: (i: number) => (i === 0 ? paramsNode : null),
  })
}

describe('function-max-params', () => {
  it('has correct id', () => {
    expect(getRule().id).toBe('function-max-params')
  })

  it('defaults to error severity', () => {
    expect(getRule().severity).toBe('error')
  })

  it('uses custom severity from config', () => {
    expect(getRule({ severity: 'warning' }).severity).toBe('warning')
  })

  it('uses default max of 4', () => {
    const rule = getRule()
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(rule, makeFunction('function_declaration', 4), ctx, report)
    expect(report).not.toHaveBeenCalled()
    callVisitor(rule, makeFunction('function_declaration', 5), ctx, report)
    expect(report).toHaveBeenCalledOnce()
  })

  it('uses custom max from config', () => {
    const rule = getRule({ max: 2 })
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(rule, makeFunction('function_declaration', 2), ctx, report)
    expect(report).not.toHaveBeenCalled()
    callVisitor(rule, makeFunction('function_declaration', 3), ctx, report)
    expect(report).toHaveBeenCalledOnce()
  })

  it.each([
    'function_declaration',
    'function_expression',
    'arrow_function',
    'method_definition',
  ])('matches %s node type in typescript', (type) => {
    const rule = getRule({ max: 0 })
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(rule, makeFunction(type, 1), ctx, report)
    expect(report).toHaveBeenCalledOnce()
  })

  it('ignores non-function nodes', () => {
    const rule = getRule({ max: 0 })
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(rule, makeFunction('class_declaration', 5), ctx, report)
    expect(report).not.toHaveBeenCalled()
  })

  it('does not report for unsupported language', () => {
    const rule = getRule({ max: 0 })
    const ctx = makeContext('ruby')
    const report = vi.fn()
    callVisitor(rule, makeFunction('function_declaration', 5), ctx, report)
    expect(report).not.toHaveBeenCalled()
  })

  it('matches python function_definition', () => {
    const rule = getRule({ max: 2 })
    const ctx = makeContext('python')
    const report = vi.fn()
    callVisitor(rule, makeFunction('function_definition', 3, 'parameters'), ctx, report)
    expect(report).toHaveBeenCalledOnce()
    callVisitor(rule, makeFunction('function_definition', 2, 'parameters'), ctx, report)
    expect(report).toHaveBeenCalledOnce() // still only once — second call didn't trigger
  })

  it('matches java method_declaration and constructor_declaration', () => {
    const rule = getRule({ max: 1 })
    const ctx = makeContext('java')
    const report = vi.fn()
    callVisitor(rule, makeFunction('method_declaration', 2, 'formal_parameters'), ctx, report)
    callVisitor(rule, makeFunction('constructor_declaration', 2, 'formal_parameters'), ctx, report)
    expect(report).toHaveBeenCalledTimes(2)
  })

  it('does not report when function has no params node', () => {
    const rule = getRule({ max: 0 })
    const ctx = makeContext('typescript')
    const report = vi.fn()
    const node = makeNode('function_declaration', { childCount: 0, child: () => null })
    callVisitor(rule, node, ctx, report)
    expect(report).not.toHaveBeenCalled()
  })

  it('includes actual and max params in message', () => {
    const rule = getRule({ max: 2 })
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(rule, makeFunction('function_declaration', 3), ctx, report)
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('3'),
      })
    )
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('2'),
      })
    )
  })
})
