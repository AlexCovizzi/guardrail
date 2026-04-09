import { Registry, Context } from '../../core/types.js'

export default function (registry: Registry) {
  registry.register('function-max-lines', (rc) => {
    const max = rc.max ?? 60
    return {
      name: `Function exceeds ${max} lines`,
      description: 'Functions should be concise and focused',
      severity: rc.severity ?? 'error',
      match(node: any, _context: Context) {
        if (
          node.type !== 'function_declaration' &&
          node.type !== 'function_definition' &&
          node.type !== 'arrow_function' &&
          node.type !== 'method_declaration'
        )
          return false

        return node.endPosition.row - node.startPosition.row + 1 > max
      },
    }
  })
}
