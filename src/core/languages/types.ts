export interface NodePattern {
  type: string
  hasChild?: string | string[]
  lacksChild?: string | string[]
  notText?: string
}

export type SemanticKind =
  /** The top-level node of a file (program, module, source file). */
  | 'root'
  /** A callable unit of code (function, method, lambda, constructor). */
  | 'function'
  /** A type definition that can be instantiated (class, record, object). */
  | 'class'
  /** A declaration that brings external dependencies into scope. */
  | 'import'
  /** A declaration that makes a definition available to other modules. */
  | 'export'
  /** A type contract defining signatures without implementation. */
  | 'interface'
  /** A type alias or named type definition. */
  | 'type'
  /** An enumeration of named constant values. */
  | 'enum'
  /** A named scope for grouping related definitions. */
  | 'namespace'
  /** An immutable variable declaration. */
  | 'constant'
  /** A mutable variable declaration. */
  | 'variable'
  /** A conditional control flow construct that diverges execution paths (if, for, while, switch, catch, ternary). */
  | 'branch'
  /** The parameter list of a function. */
  | 'parameters'
  /** Exits a function, producing a value. Control does not return to the function. */
  | 'return'
  /** Produces a value to the caller while the function remains active (suspended, not terminated). Control may return to the function later. */
  | 'yield'
  /** A numeric literal (integer, float, hex, binary, etc.). */
  | 'number'
