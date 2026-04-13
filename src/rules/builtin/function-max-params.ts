import type { FileContext, RegisterFn, ReportFn, SyntaxNode } from '../rule.js'

function countParams(node: SyntaxNode, paramNodeType: string): number {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child?.type === paramNodeType) {
      return child.namedChildCount ?? 0
    }
  }
  return 0
}

export default function (register: RegisterFn) {
  register('function-max-params', {
    description: 'Functions should have a limited number of parameters',
    create(config) {
      const max = config.number('max', { default: 4, min: 0 })

      return {
        function(node: SyntaxNode, ctx: FileContext, report: ReportFn): void {
          const paramNodeType = ctx.language.types.parameters[0]
          if (!paramNodeType) return

          const count = countParams(node, paramNodeType)
          if (count <= max) return
          report({
            message: `Function has ${count} parameters (max: ${max})`,
            hint: 'Group related parameters into an options object',
          })
        },
      }
    },
  })
}
