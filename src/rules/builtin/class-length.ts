import { Registry, SyntaxNode, RuleContext } from '../../core/types.js'

export default function (registry: Registry) {
  registry.register('class-max-lines', {
    description: 'Classes should be focused and not too large',
    create(config) {
      const max = config.number('max', { default: 500, min: 1 })

      return {
        class(node: SyntaxNode, ctx: RuleContext): void {
          const lines = node.endPosition.row - node.startPosition.row + 1
          if (lines <= max) return
          ctx.report({
            message: `Class is ${lines} lines (max: ${max})`,
            hint: 'Extract responsibilities into separate classes',
          })
        },
      }
    },
  })
}
