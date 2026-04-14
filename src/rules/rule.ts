import type { RuleConfig } from '../config/rule-config.js'
import type { LanguageDefinition, SemanticTypeName } from '../core/language.js'
import type { ProjectContext } from '../core/project-index.js'

export interface RuleContext {
  source: string
  filename: string
  language: LanguageDefinition
  project: ProjectContext
}

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

export type ReportFn = (violation: { message: string }) => void

export type Selector = SemanticTypeName | `${SemanticTypeName}Exit` | `_${string}` | `_${string}Exit`

export type Handler = (node: SyntaxNode, ctx: RuleContext, report: ReportFn) => void

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
