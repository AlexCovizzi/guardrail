import type { LanguageDefinition } from './index.js'

export const KOTLIN: LanguageDefinition = {
  name: 'kotlin',
  extensions: ['kt', 'kts'],
  kinds: {
    root: [{ type: 'source_file' }],
    function: [
      { type: 'function_declaration' },
      { type: 'anonymous_function' },
      { type: 'lambda_expression' },
      { type: 'getter' },
      { type: 'setter' },
      { type: 'init_clause' },
    ],
    class: [{ type: 'class_declaration' }, { type: 'object_declaration' }],
    import: [{ type: 'import' }],
    export: [],
    interface: [
      { type: 'class_declaration', hasChild: 'interface' },
      { type: 'class_declaration', hasChild: 'annotation' },
    ],
    type: [{ type: 'type_alias' }],
    enum: [{ type: 'enum_declaration' }, { type: 'class_declaration', hasChild: 'enum' }],
    namespace: [],
    constant: [{ type: 'property_declaration', hasChild: 'val' }],
    variable: [{ type: 'property_declaration', hasChild: 'var' }],
    branch: [
      { type: 'if_expression' },
      { type: 'for_statement' },
      { type: 'while_statement' },
      { type: 'do_while_statement' },
      { type: 'when_entry' },
      { type: 'catch_block' },
    ],
    parameters: [{ type: 'function_value_parameters' }],
    return: [{ type: 'return_expression' }],
    yield: [],
  },
}
