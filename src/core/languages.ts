const javascript: LanguageDefinition = {
  name: 'javascript',
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

const jsx: LanguageDefinition = { ...javascript, name: 'jsx' }

const typescript: LanguageDefinition = { ...javascript, name: 'typescript' }

const tsx: LanguageDefinition = { ...javascript, name: 'tsx' }

const python: LanguageDefinition = {
  name: 'python',
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

const java: LanguageDefinition = {
  name: 'java',
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

const kotlin: LanguageDefinition = {
  name: 'kotlin',
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
  types: {
    function: readonly string[]
    class: readonly string[]
    import: readonly string[]
    branch: readonly string[]
    parameters: readonly string[]
  }
}

export const LANGUAGES: Record<string, LanguageDefinition> = {
  javascript,
  jsx,
  typescript,
  tsx,
  python,
  java,
  kotlin,
}

export type LanguageName = keyof typeof LANGUAGES

export type SemanticTypeName = keyof LanguageDefinition['types']

export function detectLanguage(filename: string): LanguageDefinition {
  const ext = filename.slice(filename.lastIndexOf('.'))
  let name: LanguageName
  switch (ext) {
    case '.tsx':
      name = 'tsx'
      break
    case '.ts':
      name = 'typescript'
      break
    case '.jsx':
      name = 'jsx'
      break
    case '.js':
      name = 'javascript'
      break
    case '.py':
      name = 'python'
      break
    case '.java':
      name = 'java'
      break
    case '.kt':
    case '.kts':
      name = 'kotlin'
      break
    default:
      throw new Error(`Cannot detect language for: ${filename}`)
  }
  return LANGUAGES[name]
}
