import type { Node, RegisterFn, ReportFn, RuleContext } from '../rule.js'

export default function (register: RegisterFn) {
  register('function-max-nesting', {
    description: 'Functions should have limited nesting depth',
    create(config) {
      const max = config.number('max', { default: 4, min: 1 })

      const stack: Array<{ maxDepth: number; currentDepth: number }> = []

      return {
        function(_node: Node, _ctx: RuleContext, _report: ReportFn): void {
          stack.push({ maxDepth: 0, currentDepth: 0 })
        },
        branch(_node: Node, _ctx: RuleContext, _report: ReportFn): void {
          if (stack.length > 0) {
            const current = stack[stack.length - 1]
            current.currentDepth++
            if (current.currentDepth > current.maxDepth) {
              current.maxDepth = current.currentDepth
            }
          }
        },
        branchExit(_node: Node, _ctx: RuleContext, _report: ReportFn): void {
          if (stack.length > 0) {
            stack[stack.length - 1].currentDepth--
          }
        },
        functionExit(_node: Node, _ctx: RuleContext, report: ReportFn): void {
          const entry = stack.pop()
          if (entry && entry.maxDepth > max) {
            report({
              message: `Function has nesting depth of ${entry.maxDepth} (max: ${max})`,
              suggestion: `Reduce nesting by inverting conditions and returning early, or by extracting nested blocks into separate functions.`,
            })
          }
        },
      }
    },
  })
}
