import type { Node, RegisterFn, ReportFn, RuleContext } from '../rule.js'

/** All field/property declaration node types (JS/TS, Python, Kotlin). */
const FIELD_TYPES = new Set([
  'public_field_definition',
  'private_field_definition',
  'field_definition',
  'property_declaration',
  'assignment',
  'annotated_assignment',
])

/**
 * Count the number of declarators in a Java field_declaration.
 * E.g. `int a, b;` → 2
 */
function countJavaFieldDeclarators(node: Node): number {
  let count = 0
  for (let i = 0; i < node.namedChildCount; i++) {
    if (node.namedChild(i)?.type === 'variable_declarator') count++
  }
  return count || 1
}

/** Count fields from a single node. Returns 0 if not a field. */
function countIfField(current: Node): number {
  if (FIELD_TYPES.has(current.type)) return 1
  if (current.type === 'field_declaration') return countJavaFieldDeclarators(current)
  return 0
}

function countFields(node: Node): number {
  let count = 0
  const stack: Node[] = []
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child) stack.push(child)
  }

  while (stack.length > 0) {
    const current = stack.pop()!
    const fieldCount = countIfField(current)
    if (fieldCount > 0) {
      count += fieldCount
      continue
    }

    // Don't descend into nested functions (methods) or nested classes
    if (current.is('function')) continue
    if (current.is('class')) continue

    for (let i = 0; i < current.childCount; i++) {
      const child = current.child(i)
      if (child) stack.push(child)
    }
  }

  return count
}

export default function (register: RegisterFn) {
  register('class-max-fields', {
    description: 'Classes should not have too many fields/properties',
    create(config) {
      const max = config.number('max', { default: 20, min: 1 })

      return {
        class(node: Node, _ctx: RuleContext, report: ReportFn): void {
          const count = countFields(node)
          if (count <= max) return
          report({
            message: `Class has ${count} fields (max: ${max})`,
            suggestion: `Split this class into smaller, more focused classes. Extract groups of related fields into their own class.`,
          })
        },
      }
    },
  })
}