import type { LanguageDefinition } from './index.js'

export const JAVA: LanguageDefinition = {
  name: 'java',
  extensions: ['java'],
  kinds: {
    function: [
      { type: 'method_declaration' },
      { type: 'constructor_declaration' },
      { type: 'compact_constructor_declaration' },
    ],
    class: [{ type: 'class_declaration' }, { type: 'record_declaration' }],
    import: [{ type: 'import_declaration' }],
    export: [],
    interface: [{ type: 'interface_declaration' }, { type: 'annotation_type_declaration' }],
    type: [],
    enum: [{ type: 'enum_declaration' }],
    namespace: [],
    constant: [],
    variable: [],
    branch: [
      { type: 'if_statement' },
      { type: 'for_statement' },
      { type: 'enhanced_for_statement' },
      { type: 'while_statement' },
      { type: 'do_statement' },
      { type: 'switch_label' },
      { type: 'catch_clause' },
      { type: 'ternary_expression' },
    ],
    parameters: [{ type: 'formal_parameters' }],
  },
}
