import type { RegisterFn, ReportFn, RuleContext, Node } from '../rule.js'

function measureDepth(node: Node, current: number): number {
  let maxChild = current
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!
    const depth = child.is('branch') ? measureDepth(child, current + 1) : measureDepth(child, current)
    if (depth > maxChild) maxChild = depth
  }
  return maxChild
}

export default function (register: RegisterFn) {
  register('function-max-nesting', {
    description: 'Functions should have limited nesting depth',
    create(config) {
      const max = config.number('max', { default: 4, min: 1 })

      return {
        function(node: Node, ctx: RuleContext, report: ReportFn): void {
          const depth = measureDepth(node, 0)
          if (depth <= max) return
          report({
            message: `Function has nesting depth of ${depth} (max: ${max})`,
          })
        },
      }
    },
  })
}
