import type { Node, RegisterFn, ReportFn, RuleContext } from '../rule.js'

export default function (register: RegisterFn) {
  register('function-max-complexity', {
    description: 'Functions should have low cyclomatic complexity',
    create(config) {
      const max = config.number('max', { default: 10, min: 1 })

      const stack: Array<{ complexity: number }> = []

      return {
        function(_node: Node, _ctx: RuleContext, _report: ReportFn): void {
          stack.push({ complexity: 1 })
        },
        branch(_node: Node, _ctx: RuleContext, _report: ReportFn): void {
          if (stack.length > 0) {
            stack[stack.length - 1].complexity++
          }
        },
        functionExit(_node: Node, _ctx: RuleContext, report: ReportFn): void {
          const entry = stack.pop()
          if (entry && entry.complexity > max) {
            report({
              message: `Function has cyclomatic complexity of ${entry.complexity} (max: ${max})`,
              suggestion: `Reduce complexity by extracting conditional branches into their own functions.`,
            })
          }
        },
      }
    },
  })
}
