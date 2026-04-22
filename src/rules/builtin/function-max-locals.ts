import type { Node, RegisterFn, ReportFn, RuleContext } from '../rule.js'

/**
 * Local variable declaration node types across supported languages.
 * JS/TS: lexical_declaration (const/let), variable_declaration (var)
 * Python: assignment
 * Java: local_variable_declaration
 * Kotlin: property_declaration (local val/var)
 */
const LOCAL_DECL_TYPES = new Set([
  'lexical_declaration',
  'variable_declaration',
  'assignment',
  'local_variable_declaration',
  'property_declaration',
])

/** Declaration categories for counting declarators. */
const DECL_WITH_VAR_DECLARATORS = new Set(['lexical_declaration', 'variable_declaration', 'local_variable_declaration'])

/**
 * Count the number of distinct variable declarators within a single declaration statement.
 * E.g. `const a = 1, b = 2` counts as 2.
 */
function countDeclarators(declNode: Node): number {
  // JS/TS/Java: count variable_declarator children
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

/** Check if a node is a boundary we shouldn't descend into. */
function isDescendBoundary(current: Node, root: Node): boolean {
  if (current.is('function') && current.id !== root.id) return true
  if (current.is('class')) return true
  return false
}

function countLocals(node: Node): number {
  let count = 0

  const stack: Node[] = []
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child) stack.push(child)
  }

  while (stack.length > 0) {
    const current = stack.pop()!

    if (LOCAL_DECL_TYPES.has(current.type)) {
      count += countDeclarators(current)
      continue
    }

    if (isDescendBoundary(current, node)) continue

    for (let i = 0; i < current.childCount; i++) {
      const child = current.child(i)
      if (child) stack.push(child)
    }
  }

  return count
}

export default function (register: RegisterFn) {
  register('function-max-locals', {
    description: 'Functions should have a limited number of local variables',
    create(config) {
      const max = config.number('max', { default: 15, min: 1 })

      return {
        function(node: Node, _ctx: RuleContext, report: ReportFn): void {
          const count = countLocals(node)
          if (count <= max) return
          report({
            message: `Function has ${count} local variables (max: ${max})`,
            suggestion: `Reduce the number of local variables by extracting self-contained logic into helper functions, or by combining related values into structured objects.`,
          })
        },
      }
    },
  })
}