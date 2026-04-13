import type { FileContext, RegisterFn, ReportFn, SyntaxNode } from '../rule.js'

export default function (register: RegisterFn) {
  register('function-max-lines', {
    description: 'Functions should be concise and focused',
    create(config) {
      const max = config.number('max', { default: 60, min: 1 })

      return {
        function(node: SyntaxNode, ctx: FileContext, report: ReportFn): void {
          const lines = node.endPosition.row - node.startPosition.row + 1
          if (lines <= max) return
          report({
            message: `Function is ${lines} lines (max: ${max})`,
          })
        },
      }
    },
  })
}
