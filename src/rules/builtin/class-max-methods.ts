import type { Node, RegisterFn, ReportFn, RuleContext } from '../rule.js'

export default function (register: RegisterFn) {
  register('class-max-methods', {
    description: 'Classes should not have too many methods',
    create(config) {
      const max = config.number('max', { default: 20, min: 1 })
      return {
        class: () => {
          let count = 0
          return {
            function: () => {
              count++
            },
            exit: (_node: Node, _ctx: RuleContext, report: ReportFn) => {
              if (count <= max) return
              report({
                message: `Class has ${count} methods (max: ${max})`,
                suggestion: `Split this class into smaller, more focused classes. Extract groups of related methods into their own class.`,
              })
            },
          }
        },
      }
    },
  })
}
