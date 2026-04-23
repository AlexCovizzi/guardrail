import type * as TreeSitter from 'web-tree-sitter'
import type { Handler, Location, ReportFn, Rule, RuleContext, VisitorMap } from '../rules/rule.js'
import type { LanguageDefinition } from './language.js'
import type { NodePattern } from './languages/types.js'
import { Node } from './node.js'
import { resolveSelector } from './selector.js'

interface ScopeMapEntry {
  handler: Handler
  pattern?: NodePattern
}

interface ScopeFrame {
  rule: Rule
  entryMap: Map<string, ScopeMapEntry[]>
  exitMap: Map<string, ScopeMapEntry[]>
  exitHandler?: Handler
  openerNodeId: number
}

export interface Violation {
  ruleId: string
  message: string
  suggestion?: string
  description: string
  location: Location
  severity: 'error' | 'warning'
}

export interface WalkResult {
  violations: Violation[]
  nodesVisited: number
  perRule: Map<string, number>
}

interface WalkContext {
  context: RuleContext
  violations: Violation[]
  perRule: Map<string, number>
}

export class RuleDispatcher {
  private readonly rules: Rule[]
  private readonly language: LanguageDefinition
  private readonly _handledRules = new Set<string>()

  constructor(rules: Rule[], language: LanguageDefinition) {
    this.rules = rules
    this.language = language
  }

  walk(tree: TreeSitter.Tree, context: RuleContext): WalkResult {
    const violations: Violation[] = []
    const perRule = new Map<string, number>()
    let nodesVisited = 0
    const scopeStack: ScopeFrame[] = []

    const rootScopeFrames = this.buildRootScopes(tree.rootNode.id)
    scopeStack.push(...rootScopeFrames)

    const stack: Array<[TreeSitter.Node, boolean]> = [[tree.rootNode, false]]

    while (stack.length > 0) {
      const [rawNode, isExit] = stack.pop()!
      nodesVisited++
      if (isExit) {
        this.exitNode(rawNode, scopeStack, { context, violations, perRule })
      } else {
        this.enterNode(rawNode, scopeStack, stack, { context, violations, perRule })
      }
    }

    return { violations, nodesVisited, perRule }
  }

  private lazyNode(rawNode: TreeSitter.Node, lang: LanguageDefinition): () => Node {
    let node: Node | undefined
    return () => {
      if (!node) node = new Node(rawNode, lang)
      return node
    }
  }

  private buildRootScopes(rootNodeId: number): ScopeFrame[] {
    const frames: ScopeFrame[] = []
    for (const rule of this.rules) {
      const frame = this.buildScopeFrame(rule, rule.visitors, rootNodeId)
      frames.push(frame)
    }
    return frames
  }

  private enterNode(
    rawNode: TreeSitter.Node,
    scopeStack: ScopeFrame[],
    stack: Array<[TreeSitter.Node, boolean]>,
    ctx: WalkContext
  ): void {
    const returnedMaps: Array<{ rule: Rule; map: VisitorMap }> = []
    const handledRules = this._handledRules
    handledRules.clear()

    const getNode = this.lazyNode(rawNode, ctx.context.language)

    for (let i = scopeStack.length - 1; i >= 0; i--) {
      const frame = scopeStack[i]
      if (handledRules.has(frame.rule.id)) continue
      const entries = frame.entryMap.get(rawNode.type)
      if (!entries) continue
      const n = getNode()
      for (const entry of entries) {
        if (entry.pattern && !n.matchesPattern(entry.pattern)) continue
        handledRules.add(frame.rule.id)
        const result = this.dispatchHandler(entry.handler, n, frame.rule, ctx)
        if (result && typeof result === 'object') {
          returnedMaps.push({ rule: frame.rule, map: result })
        }
        break
      }
    }

    for (const { rule, map } of returnedMaps) {
      scopeStack.push(this.buildScopeFrame(rule, map, rawNode.id))
    }

    stack.push([rawNode, true])
    for (let i = rawNode.childCount - 1; i >= 0; i--) {
      const child = rawNode.child(i)
      if (child) stack.push([child, false])
    }
  }

  private exitNode(rawNode: TreeSitter.Node, scopeStack: ScopeFrame[], ctx: WalkContext): void {
    const getNode = this.lazyNode(rawNode, ctx.context.language)

    const handledRules = this._handledRules
    handledRules.clear()
    for (let i = scopeStack.length - 1; i >= 0; i--) {
      const frame = scopeStack[i]
      if (handledRules.has(frame.rule.id)) continue
      const entries = frame.exitMap.get(rawNode.type)
      if (!entries) continue
      const n = getNode()
      for (const entry of entries) {
        if (entry.pattern && !n.matchesPattern(entry.pattern)) continue
        handledRules.add(frame.rule.id)
        this.dispatchHandler(entry.handler, n, frame.rule, ctx)
        break
      }
    }

    while (scopeStack.length > 0 && scopeStack[scopeStack.length - 1].openerNodeId === rawNode.id) {
      const frame = scopeStack.pop()!
      if (frame.exitHandler) {
        this.dispatchHandler(frame.exitHandler, getNode(), frame.rule, ctx)
      }
    }
  }

  private buildScopeFrame(rule: Rule, map: VisitorMap, openerNodeId: number): ScopeFrame {
    const entryMap = new Map<string, ScopeMapEntry[]>()
    const exitMap = new Map<string, ScopeMapEntry[]>()

    for (const [selector, handler] of Object.entries(map)) {
      if (handler == null) continue
      if (selector === 'exit') continue
      const resolved = resolveSelector(selector, this.language)
      for (const res of resolved) {
        const target = res.isExit ? exitMap : entryMap
        const key = res.nodeType
        const existing = target.get(key)
        const entry: ScopeMapEntry = { handler: handler as Handler, pattern: res.pattern }
        if (existing) {
          existing.push(entry)
        } else {
          target.set(key, [entry])
        }
      }
    }

    return {
      rule,
      entryMap,
      exitMap,
      exitHandler: map.exit,
      openerNodeId,
    }
  }

  private dispatchHandler(fn: Handler, node: Node, rule: Rule, ctx: WalkContext): void | VisitorMap {
    const { context, violations, perRule } = ctx
    const report: ReportFn = ({ message, suggestion, node: reportNode }) => {
      const target = reportNode ? reportNode.unwrap() : node.unwrap()
      violations.push({
        ruleId: rule.id,
        message,
        suggestion,
        description: rule.description,
        location: {
          start: { line: target.startPosition.row + 1, column: target.startPosition.column },
          end: { line: target.endPosition.row + 1, column: target.endPosition.column },
        },
        severity: rule.severity,
      })
    }
    const start = performance.now()
    const result = fn(node, context, report)
    perRule.set(rule.id, (perRule.get(rule.id) ?? 0) + (performance.now() - start))
    return result
  }
}
