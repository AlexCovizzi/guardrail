import { Registry, Context } from '../../src/core/types.js'

export default function(registry: Registry) {
  registry.register('no-console', (rc) => {
    return {
      name: 'No console statements',
      description: 'Disallow console.log and friends in production code',
      severity: rc.severity ?? 'warning',
      languages: ['typescript', 'javascript'],
      match(node: any, _context: Context) {
        if (node.type !== 'call_expression') return false
        const fn = node.childForFieldName('function')
        if (!fn || fn.type !== 'member_expression') return false
        const obj = fn.childForFieldName('object')
        const prop = fn.childForFieldName('property')
        return obj?.text === 'console' && ['log', 'warn', 'error', 'debug', 'info'].includes(prop?.text)
      },
    }
  })
}