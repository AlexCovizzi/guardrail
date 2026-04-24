import type { LanguageDefinition } from './index.js'

export const JAVA: LanguageDefinition = {
  name: 'java',
  extensions: ['java'],
  kinds: {
    root: [{ type: 'program' }],
    function: [
      { type: 'method_declaration' },
      { type: 'constructor_declaration' },
      { type: 'compact_constructor_declaration' },
      { type: 'lambda_expression' },
    ],
    class: [{ type: 'class_declaration' }, { type: 'record_declaration' }],
    import: [{ type: 'import_declaration' }],
    export: [],
    interface: [{ type: 'interface_declaration' }, { type: 'annotation_type_declaration' }],
    type: [],
    enum: [{ type: 'enum_declaration' }],
    namespace: [],
    constant: [
      { type: 'field_declaration', hasChild: 'modifiers' }, // static final, final, etc.
    ],
    variable: [{ type: 'field_declaration', lacksChild: 'modifiers' }, { type: 'local_variable_declaration' }],
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
    return: [{ type: 'return_statement' }],
    yield: [],
    number: [
      { type: 'decimal_integer_literal' },
      { type: 'decimal_floating_point_literal' },
      { type: 'hex_integer_literal' },
      { type: 'hex_floating_point_literal' },
      { type: 'octal_integer_literal' },
      { type: 'binary_integer_literal' },
    ],
  },
}
