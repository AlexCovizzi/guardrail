import type { Node, RegisterFn, ReportFn, RuleContext } from '../rule.js'
import { countDeclarators } from './utils.js'

export default function (register: RegisterFn) {
  register('class-max-fields', {
    description: 'Classes should not have too many fields',
    create(config) {
      const max = config.number('max', { default: 20, min: 1 })
      return {
        class: () => {
          let count = 0
          return {
            _publicFieldDefinition: () => {
              count++
            },
            _privateFieldDefinition: () => {
              count++
            },
            _fieldDefinition: () => {
              count++
            },
            _fieldDeclaration: (node: Node) => {
              count += countDeclarators(node)
            },
            _propertyDeclaration: () => {
              count++
            },
            _assignment: () => {
              count++
            },
            _annotatedAssignment: () => {
              count++
            },
            exit: (_node: Node, _ctx: RuleContext, report: ReportFn) => {
              if (count <= max) return
              report({
                message: `Class has ${count} fields (max: ${max})`,
                suggestion: `Split this class into smaller, more focused classes. Extract related fields and methods into their own class.`,
              })
            },
          }
        },
      }
    },
  })
}
