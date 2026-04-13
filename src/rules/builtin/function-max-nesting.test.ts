import { describe, expect, it, vi } from 'vitest'
import { RuleConfig } from '../../config/rule-config.js'
import type { SemanticTypeName } from '../../core/languages.js'
import { makeContext, makeNode } from '../../test/fixtures.js'
import { RuleRegistry } from '../registry.js'
import type { Handler } from '../rule.js'
import registerFunctionNesting from './function-max-nesting.js'

function getRule(config: Record<string, any> = {}) {
  const registry = new RuleRegistry()
  registerFunctionNesting(registry.register.bind(registry))
  const [{ ruleId, definition }] = registry.getEntries()
  const builder = new RuleConfig(ruleId, config)
  const visitors = definition.create(builder)
  const severity = config.severity ?? definition.defaultSeverity ?? 'error'
  return { id: ruleId, description: definition.description, severity, visitors }
}

function callVisitor(rule: ReturnType<typeof getRule>, node: any, ctx: any, report: any) {
  for (const [key, fn] of Object.entries(rule.visitors) as [string, Handler][]) {
    if (fn == null) continue
    const k = key.endsWith('Exit') ? key.slice(0, -4) : key
    if (k.startsWith('_')) {
      const nodeType = k.slice(1).replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
      if (nodeType === node.type) fn(node, ctx, report)
    } else if (k in ctx.language.types) {
      const langTypes = ctx.language.types[k as SemanticTypeName]
      if (langTypes.includes(node.type)) fn(node, ctx, report)
    }
  }
}

function makeBranch(type: string, ...children: any[]): any {
  return makeNode(type, {
    childCount: children.length,
    child: (i: number) => children[i] ?? null,
  })
}

describe('function-max-nesting', () => {
  it('has correct id', () => {
    expect(getRule().id).toBe('function-max-nesting')
  })

  it('uses default max of 4', () => {
    // depth 4: 4 nested if_statement nodes
    const node = makeBranch('function_declaration',
      makeBranch('if_statement',
        makeBranch('if_statement',
          makeBranch('if_statement',
            makeBranch('if_statement'),
          ),
        ),
      ),
    )
    const rule = getRule()
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(rule, node, ctx, report)
    expect(report).not.toHaveBeenCalled()
  })

  it('reports when depth exceeds default max', () => {
    // depth 5: 5 nested if_statement nodes
    const node = makeBranch('function_declaration',
      makeBranch('if_statement',
        makeBranch('if_statement',
          makeBranch('if_statement',
            makeBranch('if_statement',
              makeBranch('if_statement'),
            ),
          ),
        ),
      ),
    )
    const rule = getRule()
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(rule, node, ctx, report)
    expect(report).toHaveBeenCalledOnce()
  })

  it('uses custom max from config', () => {
    // depth 2
    const node = makeBranch('function_declaration',
      makeBranch('if_statement',
        makeBranch('if_statement'),
      ),
    )
    const rule = getRule({ max: 1 })
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(rule, node, ctx, report)
    expect(report).toHaveBeenCalledOnce()
  })

  it('uses custom severity from config', () => {
    expect(getRule({ severity: 'warning' }).severity).toBe('warning')
  })

  it('defaults to error severity', () => {
    expect(getRule().severity).toBe('error')
  })

  it.each([
    { type: 'function_declaration', language: 'typescript' },
    { type: 'function_definition', language: 'python' },
    { type: 'arrow_function', language: 'typescript' },
    { type: 'method_declaration', language: 'java' },
  ])('matches $type node type in $language', ({ type, language }) => {
    // depth 5
    const node = makeBranch(type,
      makeBranch('if_statement',
        makeBranch('if_statement',
          makeBranch('if_statement',
            makeBranch('if_statement',
              makeBranch('if_statement'),
            ),
          ),
        ),
      ),
    )
    const rule = getRule({ max: 2 })
    const ctx = makeContext(language)
    const report = vi.fn()
    callVisitor(rule, node, ctx, report)
    expect(report).toHaveBeenCalledOnce()
  })

  it('ignores non-function nodes', () => {
    const node = makeBranch('if_statement',
      makeBranch('if_statement',
        makeBranch('if_statement',
          makeBranch('if_statement',
            makeBranch('if_statement'),
          ),
        ),
      ),
    )
    const rule = getRule({ max: 2 })
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(rule, node, ctx, report)
    expect(report).not.toHaveBeenCalled()
  })

  it('includes actual and max depth in message', () => {
    const node = makeBranch('function_declaration',
      makeBranch('if_statement',
        makeBranch('if_statement',
          makeBranch('if_statement'),
        ),
      ),
    )
    const rule = getRule({ max: 1 })
    const ctx = makeContext('typescript')
    const report = vi.fn()
    callVisitor(rule, node, ctx, report)
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('3') }),
    )
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('1') }),
    )
  })
})
