// Example custom rule: limit nesting depth
// Place in .guardrail/rules/max-nesting.ts  for a project-local rule
// or ~/.config/guardrail/rules/max-nesting.ts for a global rule
import type { RegisterFn, SyntaxNode } from '@alexcvzz/guardrail'

export default function(register: RegisterFn) {
  register('max-nesting', {
    description: 'Limit nesting depth in functions',
    create(config) {
      const maxDepth = config.number('max', { default: 4, min: 1 })

      return {
        function(node: SyntaxNode, ctx, report) {
          const depth = measureDepth(node, 0)
          if (depth > maxDepth) {
            report({
              message: `Function has nesting depth of ${depth} (max: ${maxDepth})`,
            })
          }
        },
      }
    },
  })
}

function measureDepth(node: any, current: number): number {
  let maxChild = current
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (!child) continue
    const isBlock = child.type === 'statement_block' || child.type === 'block'
    const childDepth = isBlock ? measureDepth(child, current + 1) : measureDepth(child, current)
    if (childDepth > maxChild) maxChild = childDepth
  }
  return maxChild
}
