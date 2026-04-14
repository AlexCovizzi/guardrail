const JAVASCRIPT: LanguageDefinition = {
  name: 'javascript',
  extensions: ['js'],
  types: {
    function: ['function_declaration', 'function_expression', 'arrow_function', 'method_definition'],
    class: ['class_declaration', 'class'],
    import: ['import_statement'],
    branch: [
      'if_statement',
      'for_statement',
      'for_in_statement',
      'for_of_statement',
      'while_statement',
      'do_statement',
      'switch_case',
      'catch_clause',
      'ternary_expression',
    ],
    parameters: ['formal_parameters'],
  },
}

const JSX: LanguageDefinition = { ...JAVASCRIPT, name: 'jsx', extensions: ['jsx'] }

const TYPESCRIPT: LanguageDefinition = { ...JAVASCRIPT, name: 'typescript', extensions: ['ts'] }

const TSX: LanguageDefinition = { ...JAVASCRIPT, name: 'tsx', extensions: ['tsx'] }

const PYTHON: LanguageDefinition = {
  name: 'python',
  extensions: ['py'],
  types: {
    function: ['function_definition'],
    class: ['class_definition'],
    import: ['import_statement', 'import_from_statement'],
    branch: [
      'if_statement',
      'elif_clause',
      'for_statement',
      'while_statement',
      'except_clause',
      'conditional_expression',
    ],
    parameters: ['parameters'],
  },
}

const JAVA: LanguageDefinition = {
  name: 'java',
  extensions: ['java'],
  types: {
    function: ['method_declaration', 'constructor_declaration', 'compact_constructor_declaration'],
    class: ['class_declaration'],
    import: ['import_declaration'],
    branch: [
      'if_statement',
      'for_statement',
      'enhanced_for_statement',
      'while_statement',
      'do_statement',
      'switch_label',
      'catch_clause',
      'ternary_expression',
    ],
    parameters: ['formal_parameters'],
  },
}

const KOTLIN: LanguageDefinition = {
  name: 'kotlin',
  extensions: ['kt', 'kts'],
  types: {
    function: ['function_declaration', 'anonymous_function', 'lambda_expression', 'getter', 'setter', 'init_clause'],
    class: ['class_declaration', 'object_declaration'],
    import: ['import'],
    branch: ['if_expression', 'for_statement', 'while_statement', 'do_while_statement', 'when_entry', 'catch_block'],
    parameters: ['function_value_parameters'],
  },
}

export interface LanguageDefinition {
  name: string
  extensions: readonly string[]
  types: {
    function: readonly string[]
    class: readonly string[]
    import: readonly string[]
    branch: readonly string[]
    parameters: readonly string[]
  }
}

export type SemanticTypeName = keyof LanguageDefinition['types']

export const Language: Record<string, LanguageDefinition> = {
  JAVASCRIPT,
  JSX,
  TYPESCRIPT,
  TSX,
  PYTHON,
  JAVA,
  KOTLIN,
}

export const SUPPORTED_EXTENSIONS: string[] = Object.values(Language).flatMap((l) => l.extensions)

export function detectLanguage(filename: string): LanguageDefinition | null {
  const dot = filename.lastIndexOf('.')
  if (dot === -1) return null
  const ext = filename.slice(dot + 1)
  return Object.values(Language).find((l) => l.extensions.includes(ext)) ?? null
}
