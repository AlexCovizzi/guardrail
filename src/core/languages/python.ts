import type { LanguageDefinition } from './index.js'

export const PYTHON: LanguageDefinition = {
  name: 'python',
  extensions: ['py'],
  kinds: {
    root: [{ type: 'module' }],
    function: [{ type: 'function_definition' }],
    class: [{ type: 'class_definition' }],
    import: [{ type: 'import_statement' }, { type: 'import_from_statement' }],
    export: [],
    interface: [],
    type: [],
    enum: [],
    namespace: [],
    constant: [],
    variable: [{ type: 'assignment' }, { type: 'expression_statement', hasChild: 'assignment' }],
    branch: [
      { type: 'if_statement' },
      { type: 'elif_clause' },
      { type: 'for_statement' },
      { type: 'while_statement' },
      { type: 'except_clause' },
      { type: 'conditional_expression' },
    ],
    parameters: [{ type: 'parameters' }],
  },
}
