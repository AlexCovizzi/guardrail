import type { Node, RegisterFn, ReportFn, RuleContext } from '../rule.js'

/**
 * Return/yield node types across supported languages.
 * JS/TS/Python/Java: return_statement
 * Kotlin: return_expression
 */
const RETURN_TYPES = new Set(['return_statement', 'return_expression'])

/** Yield node types. */
const YIELD_TYPES = new Set(['yield_expression'])

function countReturns(node: Node): number {
  let count = 0
  const rootId = node.id

  const stack: Node[] = []
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child) stack.push(child)
  }

  while (stack.length > 0) {
    const current = stack.pop()!

    if (RETURN_TYPES.has(current.type) || YIELD_TYPES.has(current.type)) {
      count++
      continue // Don't descend into return sub-nodes
    }

    // Don't count returns in nested functions — they belong to the inner function
    if (current.is('function') && current.id !== rootId) continue

    for (let i = 0; i < current.childCount; i++) {
      const child = current.child(i)
      if (child) stack.push(child)
    }
  }

  return count
}

export default function (register: RegisterFn) {
  register('function-max-returns', {
    description: 'Functions should have a limited number of return statements',
    create(config) {
      const max = config.number('max', { default: 4, min: 1 })

      return {
        function(node: Node, _ctx: RuleContext, report: ReportFn): void {
          const count = countReturns(node)
          if (count <= max) return
          report({
            message: `Function has ${count} return statements (max: ${max})`,
            suggestion: `Reduce the number of return points by restructuring the logic. Consider using a single return with a result variable, or extract complex branching into helper functions.`,
          })
        },
      }
    },
  })
}
