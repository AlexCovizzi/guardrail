import type { Node, RegisterFn, ReportFn, RuleContext } from '../rule.js'

export default function (register: RegisterFn) {
  register('max-file-lines', {
    description: 'Files should not be too long',
    defaultSeverity: 'warning',
    create(config) {
      const max = config.number('max', { default: 300, min: 1 })

      return {
        root(node: Node, _ctx: RuleContext, report: ReportFn): void {
          const lines = node.endPosition.row + 1
          if (lines <= max) return
          report({
            message: `File is ${lines} lines (max: ${max})`,
            suggestion: `Split this file into smaller, more focused modules. Group related functionality together and extract the rest into separate files.`,
          })
        },
      }
    },
  })
}
