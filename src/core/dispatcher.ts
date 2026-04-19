import type * as TreeSitter from 'web-tree-sitter'
import type { Handler, Location, ReportFn, Rule, RuleContext } from '../rules/rule.js'
import type { LanguageDefinition } from './language.js'
import type { NodePattern } from './languages/types.js'
import { Node } from './node.js'
import { resolveSelector } from './selector.js'

type DispatchEntry = { rule: Rule; fn: Handler; pattern?: NodePattern }
type DispatchMap = Map<string, DispatchEntry[]>

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
  private readonly map: DispatchMap

  constructor(rules: Rule[], language: LanguageDefinition) {
    this.map = this.buildDispatchMap(rules, language)
  }

  walk(tree: TreeSitter.Tree, context: RuleContext): WalkResult {
    const violations: Violation[] = []
    const perRule = new Map<string, number>()
    let nodesVisited = 0
    const stack: Array<[TreeSitter.Node, boolean]> = [[tree.rootNode, false]]

    while (stack.length > 0) {
      const [rawNode, isExit] = stack.pop()!
      const key = isExit ? `${rawNode.type}:exit` : rawNode.type
      const entries = this.map.get(key)
      nodesVisited++

      if (entries) {
        this.dispatchEntries(entries, rawNode, { context, violations, perRule })
      }

      if (!isExit) {
        stack.push([rawNode, true])
        for (let i = rawNode.childCount - 1; i >= 0; i--) {
          const child = rawNode.child(i)
          if (child) stack.push([child, false])
        }
      }
    }

    return { violations, nodesVisited, perRule }
  }

  private buildDispatchMap(rules: Rule[], language: LanguageDefinition): DispatchMap {
    const map: DispatchMap = new Map()
    for (const rule of rules) {
      for (const [rawKey, fn] of Object.entries(rule.visitors)) {
        if (fn == null) continue
        const resolved = resolveSelector(rawKey, language)
        for (const { nodeType, isExit, pattern } of resolved) {
          const key = isExit ? `${nodeType}:exit` : nodeType
          if (!map.has(key)) map.set(key, [])
          map.get(key)?.push({ rule, fn, pattern })
        }
      }
    }
    return map
  }

  private dispatchEntries(
    entries: DispatchEntry[],
    rawNode: TreeSitter.Node,
    ctx: { context: RuleContext; violations: Violation[]; perRule: Map<string, number> }
  ): void {
    const { context, violations, perRule } = ctx
    const node = new Node(rawNode, context.language)
    for (const { rule, fn, pattern } of entries) {
      // Skip if the node doesn't satisfy the selector's hasChild/lacksChild constraints
      if (pattern && !node.matchesPattern(pattern)) continue
      const report: ReportFn = ({ message, suggestion, node: reportNode }) => {
        const target = reportNode ? reportNode.unwrap() : rawNode
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
      fn(node, context, report)
      perRule.set(rule.id, (perRule.get(rule.id) ?? 0) + (performance.now() - start))
    }
  }
}
