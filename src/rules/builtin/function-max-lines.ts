import type { Node, RegisterFn, ReportFn, RuleContext } from '../rule.js'

export default function (register: RegisterFn) {
  register('function-max-lines', {
    description: 'Functions should be concise and focused',
    create(config) {
      const max = config.number('max', { default: 60, min: 1 })

      return {
        function(node: Node, ctx: RuleContext, report: ReportFn): void {
          const lines = node.endPosition.row - node.startPosition.row + 1
          if (lines <= max) return
          report({
            message: `Function is ${lines} lines (max: ${max})`,
            suggestion: `Split this function into ${Math.ceil(lines / max)} or more smaller functions, each under ${max} lines. Extract self-contained steps into their own named functions.`,
          })
        },
      }
    },
  })
}
