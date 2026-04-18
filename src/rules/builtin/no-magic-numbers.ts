import type { Node, RegisterFn, ReportFn, RuleContext } from '../rule.js'

/**
 * Numeric literal node types across all supported languages.
 * JS/TS: number
 * Python: integer, float
 * Java: decimal_integer_literal, decimal_floating_point_literal, etc.
 * Kotlin: integer_literal, real_literal, hex_literal, binary_literal
 */
const NUMERIC_TYPES = [
  'number',
  'integer',
  'float',
  'decimal_integer_literal',
  'decimal_floating_point_literal',
  'hex_integer_literal',
  'octal_integer_literal',
  'binary_integer_literal',
  'integer_literal',
  'real_literal',
  'hex_literal',
]

/** Node types that represent declarations where numeric values are expected/acceptable. */
const ALLOWED_PARENT_TYPES = new Set([
  'constant_declaration', // TS const
  'lexical_declaration', // JS/TS const/let
  'variable_declaration', // JS/TS var
  'enum_declaration', // TS enum
  'enum_assignment', // Python enum
  'enum_body', // TS/Kotlin/Java enum body
  'pair', // object literal property
  'property_assignment', // TS property assignment
  'import_statement', // import source (not a numeric but just in case)
  'import_from_statement', // Python import
  'formal_parameters', // function parameter defaults
  'default_parameter', // Python default param
  'assignment', // Python constant assignment
])

/** Check if a numeric node is inside an allowed parent context. */
function isInAllowedContext(node: Node): boolean {
  let current: Node | null = node.parent
  while (current) {
    if (ALLOWED_PARENT_TYPES.has(current.type)) return true
    // Stop at function boundaries — const inside a function is still a local const
    if (current.is('function')) break
    current = current.parent
  }
  return false
}

/** Check if a numeric node is used as an array/object index (e.g. arr[0]). */
function isIndex(node: Node): boolean {
  const parent = node.parent
  if (!parent) return false
  // arr[0] — the 0 is inside a subscript
  if (parent.type === 'subscript_expression' || parent.type === 'index_expression') return true
  return false
}

/** Parse a numeric literal string to a JavaScript number for comparison. */
function parseNumericValue(text: string): number | null {
  // Strip underscores (JS numeric separator, Kotlin)
  const cleaned = text.replace(/_/g, '')
  // Handle hex
  if (cleaned.startsWith('0x') || cleaned.startsWith('0X')) {
    return parseInt(cleaned, 16)
  }
  // Handle binary
  if (cleaned.startsWith('0b') || cleaned.startsWith('0B')) {
    return parseInt(cleaned.slice(2), 2)
  }
  // Handle octal
  if (cleaned.startsWith('0o') || cleaned.startsWith('0O')) {
    return parseInt(cleaned.slice(2), 8)
  }
  const num = Number(cleaned)
  return Number.isNaN(num) ? null : num
}

export default function registerNoMagicNumbers(register: RegisterFn) {
  register('no-magic-numbers', {
    description: 'Disallow unnamed numeric literals',
    defaultSeverity: 'warning',
    create(config) {
      const ignoreStr = config.string('ignore', { default: '0,1,-1' })
      const ignoreSet = new Set(
        ignoreStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      )

      return {
        function(node: Node, _ctx: RuleContext, report: ReportFn): void {
          const numbers = node.descendantsOfType(NUMERIC_TYPES)
          for (const numNode of numbers) {
            const text = numNode.text

            // Skip if the text value is in the ignore list
            if (ignoreSet.has(text)) continue

            // Skip if inside an allowed context (const, enum, etc.)
            if (isInAllowedContext(numNode)) continue

            // Skip if used as an index
            if (isIndex(numNode)) continue

            // Skip negative numbers that are in the ignore list through parent unary minus
            const parent = numNode.parent
            if (parent?.type === 'unary_expression' && parent.child(0)?.text === '-') {
              const negated = `-${text}`
              if (ignoreSet.has(negated)) continue
            }

            report({
              message: `Magic number: ${text}`,
              suggestion: `Extract this number into a named constant for clarity.`,
              node: numNode,
            })
          }
        },
      }
    },
  })
}
