import type { RuleConfig } from '../config/rule-config.js'
import type { LanguageDefinition } from '../core/language.js'
import type { SemanticKind } from '../core/languages/types.js'
import { Node } from '../core/node.js'
import { Tree } from '../core/tree.js'
import { TreeCursor } from '../core/tree-cursor.js'

export { Node, Tree, TreeCursor }

export interface RuleContext {
  source: string
  filename: string
  language: LanguageDefinition
}

export interface Position {
  line: number
  column: number
}

export interface Location {
  start: Position
  end: Position
}

export type ReportFn = (violation: { message: string }) => void

export type Selector = SemanticKind | `${SemanticKind}Exit` | `_${string}` | `_${string}Exit`

export type Handler = (node: Node, ctx: RuleContext, report: ReportFn) => void

export type RegisterFn = (id: string, definition: RuleDefinition) => void

export interface RuleDefinition {
  description: string
  defaultSeverity?: 'error' | 'warning'

  create(config: RuleConfig): Partial<Record<Selector, Handler>>
}

export interface Rule {
  id: string
  description: string
  severity: 'error' | 'warning'
  enabled?: boolean
  languages?: LanguageDefinition['name'][]
  visitors: Partial<Record<Selector, Handler>>
}
