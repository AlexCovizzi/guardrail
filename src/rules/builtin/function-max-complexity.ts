import type { Node, RegisterFn, ReportFn, RuleContext } from '../rule.js'

export default function (register: RegisterFn) {
  register('function-max-complexity', {
    description: 'Functions should have low cyclomatic complexity',
    create(config) {
      const max = config.number('max', { default: 10, min: 1 })
      return {
        function: () => {
          let complexity = 1
          return {
            branch: () => {
              complexity++
            },
            exit: (_node: Node, _ctx: RuleContext, report: ReportFn) => {
              if (complexity <= max) return
              report({
                message: `Function has cyclomatic complexity of ${complexity} (max: ${max})`,
                suggestion: `Reduce complexity by extracting conditional branches into their own functions.`,
              })
            },
          }
        },
      }
    },
  })
}
