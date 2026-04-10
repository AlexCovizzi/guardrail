import { Registry, SyntaxNode, RuleContext } from '../../core/types.js'

export default function (registry: Registry) {
  registry.register('function-max-lines', {
    description: 'Functions should be concise and focused',
    create(config) {
      const max = config.number('max', { default: 60, min: 1 })

      return {
        function(node: SyntaxNode, ctx: RuleContext): void {
          const lines = node.endPosition.row - node.startPosition.row + 1
          if (lines <= max) return
          ctx.report({
            message: `Function is ${lines} lines (max: ${max})`,
            hint: 'Split this function into smaller, focused functions',
          })
        },
      }
    },
  })
}
