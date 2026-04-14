import type { RegisterFn, ReportFn, RuleContext, SyntaxNode } from '../rule.js'

export default function (register: RegisterFn) {
  register('class-max-lines', {
    description: 'Classes should be focused and not too large',
    create(config) {
      const max = config.number('max', { default: 500, min: 1 })

      return {
        class(node: SyntaxNode, ctx: RuleContext, report: ReportFn): void {
          const lines = node.endPosition.row - node.startPosition.row + 1
          if (lines <= max) return
          report({
            message: `Class is ${lines} lines (max: ${max})`,
          })
        },
      }
    },
  })
}
