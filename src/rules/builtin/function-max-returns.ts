import type { Node, RegisterFn, ReportFn, RuleContext } from '../rule.js'

export default function (register: RegisterFn) {
  register('function-max-returns', {
    description: 'Functions should have a limited number of return statements',
    create(config) {
      const max = config.number('max', { default: 4, min: 1 })
      return {
        function: () => {
          let count = 0
          return {
            return() {
              count++
            },
            yield() {
              count++
            },
            exit(_node: Node, _ctx: RuleContext, report: ReportFn) {
              if (count <= max) return
              report({
                message: `Function has ${count} return statements (max: ${max})`,
                suggestion: `Reduce the number of return points by restructuring the logic. Consider using a single return with a result variable, or extract complex branching into helper functions.`,
              })
            },
          }
        },
      }
    },
  })
}
