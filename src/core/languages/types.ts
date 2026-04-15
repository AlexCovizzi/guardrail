export interface NodePattern {
  type: string
  hasChild?: string | string[]
  lacksChild?: string | string[]
}

export type SemanticKind =
  | 'function'
  | 'class'
  | 'import'
  | 'export'
  | 'interface'
  | 'type'
  | 'enum'
  | 'namespace'
  | 'constant'
  | 'variable'
  | 'branch'
  | 'parameters'
