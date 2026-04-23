import type { Node } from '../rule.js'

// JS/TS/Java node types where variable count comes from child variable_declarator nodes.
// E.g. `const a = 1, b = 2` → 2; Java `int a, b;` → 2.
const DECL_WITH_VAR_DECLARATORS = new Set([
  'lexical_declaration',
  'variable_declaration',
  'local_variable_declaration',
  'field_declaration',
])

/** Count the number of distinct variable declarators within a single declaration statement. */
export function countDeclarators(declNode: Node): number {
  if (DECL_WITH_VAR_DECLARATORS.has(declNode.type)) {
    let count = 0
    for (let i = 0; i < declNode.namedChildCount; i++) {
      if (declNode.namedChild(i)?.type === 'variable_declarator') count++
    }
    return count || 1
  }

  // Kotlin: property_declaration — count identifiers
  if (declNode.type === 'property_declaration') {
    const ids = declNode.descendantsOfType(['identifier', 'property_identifier'])
    return ids.length || 1
  }

  // Python: assignment — could be tuple unpacking: a, b = 1, 2
  if (declNode.type === 'assignment') {
    const lhs = declNode.namedChild(0)
    if (lhs && (lhs.type === 'tuple' || lhs.type === 'list')) {
      return lhs.namedChildCount
    }
  }

  return 1
}
