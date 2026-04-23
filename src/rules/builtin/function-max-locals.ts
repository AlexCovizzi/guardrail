import type { Node, RegisterFn, ReportFn, RuleContext } from '../rule.js'
import { countDeclarators } from './utils.js'

export default function (register: RegisterFn) {
  register('function-max-locals', {
    description: 'Functions should have a limited number of local variables',
    create(config) {
      const max = config.number('max', { default: 15, min: 1 })
      return {
        function: () => {
          let count = 0
          return {
            _lexicalDeclaration: (node: Node) => {
              count += countDeclarators(node)
            },
            _variableDeclaration: (node: Node) => {
              if (node.parent?.type === 'property_declaration') return
              count += countDeclarators(node)
            },
            _assignment: (node: Node) => {
              count += countDeclarators(node)
            },
            _localVariableDeclaration: (node: Node) => {
              count += countDeclarators(node)
            },
            _propertyDeclaration: (node: Node) => {
              count += countDeclarators(node)
            },
            exit: (_node: Node, _ctx: RuleContext, report: ReportFn) => {
              if (count <= max) return
              report({
                message: `Function has ${count} local variables (max: ${max})`,
                suggestion: `Reduce the number of local variables by extracting self-contained logic into helper functions, or by combining related values into structured objects.`,
              })
            },
          }
        },
      }
    },
  })
}
