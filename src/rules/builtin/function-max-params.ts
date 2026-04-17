import type { Node, RegisterFn, ReportFn, RuleContext } from '../rule.js'

export default function (register: RegisterFn) {
  register('function-max-params', {
    description: 'Functions should have a limited number of parameters',
    create(config) {
      const max = config.number('max', { default: 4, min: 0 })

      return {
        function(node: Node, ctx: RuleContext, report: ReportFn): void {
          let paramCount = 0
          for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i)
            if (child && child.is('parameters')) {
              paramCount = child.namedChildCount
              break
            }
          }
          if (paramCount <= max) return
          report({
            message: `Function has ${paramCount} parameters (max: ${max})`,
            suggestion: `Group related parameters into a single object parameter. Keep unrelated parameters separate.`,
          })
        },
      }
    },
  })
}
