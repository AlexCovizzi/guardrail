import { Registry, Context, ConfigSchema } from '../../core/types.js'

const schema = {
  max: { type: 'number', default: 60, min: 1 },
} satisfies ConfigSchema

export default function (registry: Registry) {
  registry.register('function-max-lines', schema, (rc) => ({
    name: `Function exceeds ${rc.max} lines`,
    description: 'Functions should be concise and focused',
    severity: rc.severity,
    match(node: any, _context: Context) {
      if (
        node.type !== 'function_declaration' &&
        node.type !== 'function_definition' &&
        node.type !== 'arrow_function' &&
        node.type !== 'method_declaration'
      )
        return false

      return node.endPosition.row - node.startPosition.row + 1 > rc.max
    },
  }))
}