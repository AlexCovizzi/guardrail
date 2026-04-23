import type * as TreeSitter from 'web-tree-sitter'
import type { Handler, Location, ReportFn, Rule, RuleContext, VisitorMap } from '../rules/rule.js'
import type { LanguageDefinition } from './language.js'
import { Node } from './node.js'
import { ScopeChain, type ScopeFrame, type ScopeMapEntry } from './scope-chain.js'
import { resolveSelector } from './selector.js'

type TraversalStep = [node: TreeSitter.Node, isExit: boolean]

interface WalkState {
  context: RuleContext
  violations: Violation[]
  perRule: Map<string, number>
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

export class RuleDispatcher {
  constructor(
    private readonly rules: Rule[],
    private readonly language: LanguageDefinition
  ) {}

  walk(tree: TreeSitter.Tree, context: RuleContext): WalkResult {
    const state: WalkState = {
      context,
      violations: [],
      perRule: new Map(),
    }

    const scopes = new ScopeChain()
    for (const rule of this.rules) {
      scopes.enter(this.buildScopeFrame(rule, rule.visitors, tree.rootNode.id))
    }

    let nodesVisited = 0
    const traversal: TraversalStep[] = [[tree.rootNode, false]]

    while (traversal.length > 0) {
      const [rawNode, isExit] = traversal.pop()!
      nodesVisited++
      if (!scopes.tracks(rawNode.type)) {
        pushChildren(rawNode, traversal)
        continue
      }
      if (isExit) this.handleExit(rawNode, scopes, state)
      else this.handleEnter(rawNode, scopes, traversal, state)
    }

    return { violations: state.violations, nodesVisited, perRule: state.perRule }
  }

  private handleEnter(
    rawNode: TreeSitter.Node,
    scopes: ScopeChain,
    traversal: TraversalStep[],
    state: WalkState
  ): void {
    const newFrames = this.dispatch(rawNode, scopes, 'entry', state)
    for (const frame of newFrames) scopes.enter(frame)
    traversal.push([rawNode, true])
    pushChildren(rawNode, traversal)
  }

  private handleExit(rawNode: TreeSitter.Node, scopes: ScopeChain, state: WalkState): void {
    this.dispatch(rawNode, scopes, 'exit', state)
    let node: Node | undefined
    for (const frame of scopes.closeAt(rawNode.id)) {
      if (!frame.exitHandler) continue
      node ??= new Node(rawNode, state.context.language)
      this.invokeHandler(frame.exitHandler, node, frame.rule, state)
    }
  }

  /**
   * Fire handlers for `mode` on all scope frames, closest-defined-scope-wins.
   * Returns any new scope frames produced by entry handlers that returned a nested VisitorMap.
   */
  private dispatch(
    rawNode: TreeSitter.Node,
    scopes: ScopeChain,
    mode: 'entry' | 'exit',
    state: WalkState
  ): ScopeFrame[] {
    const handled = new Set<string>()
    const newFrames: ScopeFrame[] = []
    let node: Node | undefined

    for (let i = scopes.size - 1; i >= 0; i--) {
      const frame = scopes.at(i)
      if (handled.has(frame.rule.id)) continue
      const entries = (mode === 'entry' ? frame.entryMap : frame.exitMap).get(rawNode.type)
      if (!entries) continue
      node ??= new Node(rawNode, state.context.language)
      for (const entry of entries) {
        if (entry.pattern && !node.matchesPattern(entry.pattern)) continue
        handled.add(frame.rule.id)
        const result = this.invokeHandler(entry.handler, node, frame.rule, state)
        if (mode === 'entry' && result && typeof result === 'object') {
          newFrames.push(this.buildScopeFrame(frame.rule, result, rawNode.id))
        }
        break
      }
    }

    return newFrames
  }

  private buildScopeFrame(rule: Rule, map: VisitorMap, openerNodeId: number): ScopeFrame {
    const entryMap = new Map<string, ScopeMapEntry[]>()
    const exitMap = new Map<string, ScopeMapEntry[]>()

    for (const [selector, handler] of Object.entries(map)) {
      if (handler == null || selector === 'exit') continue
      for (const res of resolveSelector(selector, this.language)) {
        const target = res.isExit ? exitMap : entryMap
        const entry: ScopeMapEntry = { handler: handler as Handler, pattern: res.pattern }
        const existing = target.get(res.nodeType)
        if (existing) existing.push(entry)
        else target.set(res.nodeType, [entry])
      }
    }

    return { rule, entryMap, exitMap, exitHandler: map.exit, openerNodeId }
  }

  private invokeHandler(fn: Handler, node: Node, rule: Rule, state: WalkState): void | VisitorMap {
    const report: ReportFn = ({ message, suggestion, node: reportNode }) => {
      const target = (reportNode ?? node).unwrap()
      state.violations.push({
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
    const result = fn(node, state.context, report)
    state.perRule.set(rule.id, (state.perRule.get(rule.id) ?? 0) + (performance.now() - start))
    return result
  }
}

function pushChildren(node: TreeSitter.Node, stack: TraversalStep[]): void {
  for (let i = node.childCount - 1; i >= 0; i--) {
    const child = node.child(i)
    if (child) stack.push([child, false])
  }
}
