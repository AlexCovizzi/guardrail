// Example custom rule: enforce naming convention for exported functions
// Place in .guardrail/rules/exported-naming.ts for a project-local rule
// or ~/.config/guardrail/rules/exported-naming.ts for a global rule
import type { RegisterFn, SyntaxNode } from '@alexcvzz/guardrail'

export default function(register: RegisterFn) {
  register('exported-naming', {
    description: 'Exported functions must match a naming pattern',
    defaultSeverity: 'error',
    create(config) {
      const pattern = config.string('pattern', { default: '^[a-z][a-zA-Z0-9]*$' })
      const re = new RegExp(pattern)

      return {
        function(node: SyntaxNode, ctx, report) {
          if (node.parent?.type !== 'export_statement' && node.parent?.parent?.type !== 'export_statement') return

          let name: string | undefined
          for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i)
            if (child?.type === 'identifier' || child?.type === 'property_identifier') {
              name = child.text
              break
            }
          }
          if (!name) return
          if (re.test(name)) return

          report({
            message: `Exported function "${name}" does not match pattern /${pattern}/`,
          })
        },
      }
    },
  })
}
