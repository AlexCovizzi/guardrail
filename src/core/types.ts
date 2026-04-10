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

export interface Violation {
  ruleId: string
  message: string
  description: string
  location: Location
  severity: 'error' | 'warning'
  hint?: string
}

export interface Context {
  source: string
  filename: string
  language: string
  tree: any
}

export interface RuleContext extends Context {
  report(violation: { message: string; hint?: string }): void
}

export type VisitorFn = (node: SyntaxNode, ctx: RuleContext) => void

export interface Rule {
  id: string
  description: string
  severity: 'error' | 'warning'
  enabled?: boolean
  languages?: string[]
  visitors: Record<string, VisitorFn>
}

export interface ConfigBuilder {
  number(key: string, options: { default: number; min?: number; max?: number }): number
  string(key: string, options: { default: string; minLength?: number; maxLength?: number }): string
  boolean(key: string, options: { default: boolean }): boolean
  enum<T extends readonly (string | number)[]>(key: string, options: { values: T; default: T[number] }): T[number]
}

export interface RuleDefinition {
  description: string
  defaultSeverity?: 'error' | 'warning'
  create(config: ConfigBuilder): Record<string, VisitorFn>
}

export interface Registry {
  register(id: string, definition: RuleDefinition): void
}

export interface RuleConfig {
  enabled?: boolean
  disabled?: boolean
  severity?: string
  [key: string]: unknown
}

export type StringField = {
  type: 'string'
  default?: string
  minLength?: number
  maxLength?: number
}

export type NumberField = {
  type: 'number'
  default?: number
  min?: number
  max?: number
}

export type BooleanField = {
  type: 'boolean'
  default?: boolean
}

export type EnumField<T extends readonly (string | number)[] = readonly (string | number)[]> = {
  type: 'enum'
  values: T
  default?: T[number]
}

export type FieldDef = StringField | NumberField | BooleanField | EnumField

export type ConfigSchema = Record<string, FieldDef>

type InferField<F extends FieldDef> =
  F extends { type: 'string' } ? string :
  F extends { type: 'number' } ? number :
  F extends { type: 'boolean' } ? boolean :
  F extends EnumField<infer T> ? T[number] :
  never

export type ResolvedConfig<S extends ConfigSchema> = {
  [K in keyof S]: InferField<S[K]>
} & { severity: 'error' | 'warning' }

export interface Config {
  rules?: Record<string, RuleConfig>
  overrides?: Record<string, { rules?: Record<string, RuleConfig> }>
}

export interface Result {
  filename: string
  violations: Violation[]
  passed: boolean
}
