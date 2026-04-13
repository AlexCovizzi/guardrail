import type { RuleConfig } from '../config/rule-config.js'
import type { LanguageDefinition, SemanticTypeName } from '../core/languages.js'

export interface SyntaxNode {
  type: string
  text: string
  startPosition: { row: number; column: number }
  endPosition: { row: number; column: number }
  startIndex: number
  endIndex: number
  childCount: number
  namedChildCount: number

  child(index: number): SyntaxNode | null

  namedChild(index: number): SyntaxNode | null

  parent: SyntaxNode | null
  isNamed: boolean
}

export interface Position {
  line: number
  column: number
}

export interface Location {
  start: Position
  end: Position
}

export type ReportFn = (violation: { message: string; hint?: string }) => void

export interface FileContext {
  source: string
  filename: string
  language: LanguageDefinition
  tree: any
}

export type Selector = SemanticTypeName | `${SemanticTypeName}Exit` | `_${string}` | `_${string}Exit`

export type Handler = (node: SyntaxNode, ctx: FileContext, report: ReportFn) => void

export interface RuleContext extends FileContext {
  report: ReportFn
}

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
