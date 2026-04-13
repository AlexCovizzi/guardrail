// Example custom rule: disallow console statements
// Place in .guardrail/rules/no-console.ts  for a project-local rule
// or ~/.guardrail/rules/no-console.ts for a global rule
import type { RegisterFn, SyntaxNode } from '@alexcvzz/guardrail'

export default function(register: RegisterFn) {
  register('no-console', {
    description: 'Disallow console statements',
    defaultSeverity: 'warning',
    create() {
      return {
        _identifier(node: SyntaxNode, ctx, report) {
          if (node.text !== 'console') return
          const parent = node.parent
          if (parent?.type !== 'member_expression') return
          const grandparent = parent.parent
          if (grandparent?.type !== 'call_expression') return
          report({
            message: `Unexpected console call: ${parent.child(2)?.text}`,
          })
        },
      }
    },
  })
}
