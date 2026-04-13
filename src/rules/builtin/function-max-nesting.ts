import type { FileContext, RegisterFn, ReportFn, SyntaxNode } from '../rule.js'

function measureDepth(node: SyntaxNode, branchTypes: Set<string>, current: number): number {
  let maxChild = current
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)!
    const depth = branchTypes.has(child.type)
      ? measureDepth(child, branchTypes, current + 1)
      : measureDepth(child, branchTypes, current)
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
        function(node: SyntaxNode, ctx: FileContext, report: ReportFn): void {
          const branchTypes = new Set(ctx.language.types.branch)
          const depth = measureDepth(node, branchTypes, 0)
          if (depth <= max) return
          report({
            message: `Function has nesting depth of ${depth} (max: ${max})`,
          })
        },
      }
    },
  })
}
