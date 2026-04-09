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
  [key: string]: any
}

export interface Registry {
  register(id: string, create: (config: RuleConfig) => Omit<Rule, 'id'>): void
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
