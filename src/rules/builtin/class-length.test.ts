import { describe, it, expect, vi } from 'vitest'
import { makeNode, makeContext } from '../../test/fixtures.js'
import { RuleRegistry } from '../registry.js'
import { ConfigBuilderImpl } from '../../config/builder.js'
import { RuleContext } from '../../core/types.js'
import { SemanticTypeName } from '../../core/languages.js'
import registerClassLength from './class-length.js'

function getRule(config: Record<string, any> = {}) {
  const registry = new RuleRegistry()
  registerClassLength(registry)
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

function makeClass(type: string, startRow: number, endRow: number) {
  return makeNode(type, { startPosition: { row: startRow, column: 0 }, endPosition: { row: endRow, column: 1 } })
}

describe('class-max-lines', () => {
  it('has correct id', () => {
    expect(getRule().id).toBe('class-max-lines')
  })

  it('uses default max of 300', () => {
    const rule = getRule()
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(rule, makeClass('class_declaration', 0, 299), ctx, report)
    expect(report).not.toHaveBeenCalled()
    callVisitor(rule, makeClass('class_declaration', 0, 300), ctx, report)
    expect(report).toHaveBeenCalledOnce()
  })

  it('uses custom max from config', () => {
    const rule = getRule({ max: 50 })
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(rule, makeClass('class_declaration', 0, 49), ctx, report)
    expect(report).not.toHaveBeenCalled()
    callVisitor(rule, makeClass('class_declaration', 0, 50), ctx, report)
    expect(report).toHaveBeenCalledOnce()
  })

  it('uses custom severity from config', () => {
    expect(getRule({ severity: 'warning' }).severity).toBe('warning')
  })

  it('defaults to error severity', () => {
    expect(getRule().severity).toBe('error')
  })

  it.each([
    { type: 'class_declaration', language: 'typescript' },
    { type: 'class_definition', language: 'python' },
    { type: 'class_declaration', language: 'java' },
    { type: 'class_declaration', language: 'kotlin' },
  ])('matches $type node type in $language', ({ type, language }) => {
    const rule = getRule({ max: 5 })
    const ctx = makeContext(language)
    const report = vi.fn()
    callVisitor(rule, makeClass(type, 0, 10), ctx, report)
    expect(report).toHaveBeenCalledOnce()
  })

  it('ignores non-class nodes', () => {
    const rule = getRule({ max: 5 })
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(rule, makeClass('function_declaration', 0, 100), ctx, report)
    expect(report).not.toHaveBeenCalled()
  })

  it('includes actual and max lines in message', () => {
    const rule = getRule({ max: 5 })
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(rule, makeClass('class_declaration', 0, 10), ctx, report)
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('11'),
      })
    )
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('5'),
      })
    )
  })
})
