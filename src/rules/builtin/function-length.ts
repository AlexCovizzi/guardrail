import { Registry, Context, ConfigSchema, Report } from '../../core/types.js'

const schema = {
  max: { type: 'number', default: 60, min: 1 },
} satisfies ConfigSchema

export default function (registry: Registry) {
  registry.register('function-max-lines', schema, (rc) => ({
    description: 'Functions should be concise and focused',
    severity: rc.severity,
    match(node: any, _context: Context, report: Report): void {
      if (
        node.type !== 'function_declaration' &&
        node.type !== 'function_definition' &&
        node.type !== 'arrow_function' &&
        node.type !== 'method_declaration'
      )
        return

      const lines = node.endPosition.row - node.startPosition.row + 1
      if (lines <= rc.max) return
      report({
        message: `Function is ${lines} lines (max: ${rc.max})`,
        hint: 'Split this function into smaller, focused functions',
      })
    },
  }))
}