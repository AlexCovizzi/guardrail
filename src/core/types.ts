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
  location: Location
  severity: 'error' | 'warning'
  fix?: string
}

export interface Rule {
  id: string
  name: string
  description: string
  severity: 'error' | 'warning'
  enabled?: boolean
  languages?: string[]
  match(node: any, context: Context): boolean
  fix?(node: any, context: Context): string | undefined
}

export interface Context {
  source: string
  filename: string
  language: string
  tree: any
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

/** Typed, defaults-applied config passed to a rule's create function. */
export type ResolvedConfig<S extends ConfigSchema> = {
  [K in keyof S]: InferField<S[K]>
} & { severity: 'error' | 'warning' }

export interface Registry {
  register<S extends ConfigSchema>(
    id: string,
    schema: S,
    create: (config: ResolvedConfig<S>) => Omit<Rule, 'id'>
  ): void
}

export interface Config {
  rules?: Record<string, RuleConfig>
  overrides?: Record<string, { rules?: Record<string, RuleConfig> }>
}

export interface Result {
  filename: string
  violations: Violation[]
  passed: boolean
}
