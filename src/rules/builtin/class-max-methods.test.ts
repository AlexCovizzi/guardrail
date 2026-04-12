import { describe, expect, it, vi } from 'vitest'
import { RuleConfig } from '../../config/rule-config.js'
import type { SemanticTypeName } from '../../core/languages.js'
import type { Handler } from '../rule.js'
import { makeContext, makeNode } from '../../test/fixtures.js'
import { RuleRegistry } from '../registry.js'
import registerClassMaxMethods from './class-max-methods.js'

function getRule(config: Record<string, any> = {}) {
  const registry = new RuleRegistry()
  registerClassMaxMethods(registry.register.bind(registry))
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

function makeClassWithMethods(classType: string, methodTypes: string[]) {
  const methodNodes = methodTypes.map((t) => makeNode(t))
  const bodyNode = makeNode('class_body', {
    childCount: methodNodes.length,
    child: (i: number) => methodNodes[i] ?? null,
  })
  return makeNode(classType, {
    childCount: 1,
    child: (i: number) => (i === 0 ? bodyNode : null),
  })
}

describe('class-max-methods', () => {
  it('has correct id', () => {
    expect(getRule().id).toBe('class-max-methods')
  })

  it('uses default max of 20', () => {
    const rule = getRule()
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(rule, makeClassWithMethods('class_declaration', Array(20).fill('method_definition')), ctx, report)
    expect(report).not.toHaveBeenCalled()
    callVisitor(rule, makeClassWithMethods('class_declaration', Array(21).fill('method_definition')), ctx, report)
    expect(report).toHaveBeenCalledOnce()
  })

  it('uses custom max from config', () => {
    const rule = getRule({ max: 3 })
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(rule, makeClassWithMethods('class_declaration', Array(3).fill('method_definition')), ctx, report)
    expect(report).not.toHaveBeenCalled()
    callVisitor(rule, makeClassWithMethods('class_declaration', Array(4).fill('method_definition')), ctx, report)
    expect(report).toHaveBeenCalledOnce()
  })

  it('uses custom severity from config', () => {
    expect(getRule({ severity: 'warning' }).severity).toBe('warning')
  })

  it('defaults to error severity', () => {
    expect(getRule().severity).toBe('error')
  })

  it.each([
    { classType: 'class_declaration', methodType: 'method_definition', language: 'typescript' },
    { classType: 'class_definition', methodType: 'function_definition', language: 'python' },
    { classType: 'class_declaration', methodType: 'method_declaration', language: 'java' },
    { classType: 'class_declaration', methodType: 'function_declaration', language: 'kotlin' },
  ])('matches $classType/$methodType in $language', ({ classType, methodType, language }) => {
    const rule = getRule({ max: 1 })
    const ctx = makeContext(language)
    const report = vi.fn()
    callVisitor(rule, makeClassWithMethods(classType, [methodType, methodType]), ctx, report)
    expect(report).toHaveBeenCalledOnce()
  })

  it('ignores non-class nodes', () => {
    const rule = getRule({ max: 1 })
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(
      rule,
      makeClassWithMethods('function_declaration', ['method_definition', 'method_definition']),
      ctx,
      report
    )
    expect(report).not.toHaveBeenCalled()
  })

  it('does not count methods of nested classes', () => {
    const rule = getRule({ max: 1 })
    const ctx = makeContext('typescript')
    const report = vi.fn()
    // Outer class has 1 method and 1 inner class with 2 methods — should not trigger
    const innerMethods = [makeNode('method_definition'), makeNode('method_definition')]
    const innerBody = makeNode('class_body', {
      childCount: innerMethods.length,
      child: (i: number) => innerMethods[i] ?? null,
    })
    const innerClass = makeNode('class_declaration', {
      childCount: 1,
      child: (i: number) => (i === 0 ? innerBody : null),
    })
    const outerMethod = makeNode('method_definition')
    const outerBody = makeNode('class_body', {
      childCount: 2,
      child: (i: number) => (i === 0 ? outerMethod : i === 1 ? innerClass : null),
    })
    const outerClass = makeNode('class_declaration', {
      childCount: 1,
      child: (i: number) => (i === 0 ? outerBody : null),
    })
    callVisitor(rule, outerClass, ctx, report)
    expect(report).not.toHaveBeenCalled()
  })

  it('includes actual and max count in message', () => {
    const rule = getRule({ max: 2 })
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(rule, makeClassWithMethods('class_declaration', Array(5).fill('method_definition')), ctx, report)
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('5') }))
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('2') }))
  })
})
