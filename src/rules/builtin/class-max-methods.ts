import type { Node, RegisterFn, ReportFn, RuleContext } from '../rule.js'

function countMethods(node: Node): number {
  let count = 0
  const stack: Node[] = []
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child) stack.push(child)
  }

  while (stack.length > 0) {
    const current = stack.pop()!
    if (current.is('function')) {
      count++
      continue
    }
    if (current.is('class')) continue
    for (let i = 0; i < current.childCount; i++) {
      const child = current.child(i)
      if (child) stack.push(child)
    }
  }

  return count
}

export default function (register: RegisterFn) {
  register('class-max-methods', {
    description: 'Classes should not have too many methods',
    create(config) {
      const max = config.number('max', { default: 20, min: 1 })

      return {
        class(node: Node, ctx: RuleContext, report: ReportFn): void {
          const count = countMethods(node)
          if (count <= max) return
          report({
            message: `Class has ${count} methods (max: ${max})`,
            suggestion: `Split this class into smaller, more focused classes. Extract groups of related methods into their own class.`,
          })
        },
      }
    },
  })
}
