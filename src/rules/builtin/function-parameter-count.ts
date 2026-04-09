import { Registry, Context, ConfigSchema } from '../../core/types.js'

const FUNCTION_NODES: Record<string, string[]> = {
  javascript: ['function_declaration', 'function_expression', 'arrow_function', 'method_definition'],
  typescript: ['function_declaration', 'function_expression', 'arrow_function', 'method_definition'],
  python:     ['function_definition'],
  java:       ['method_declaration', 'constructor_declaration'],
  kotlin:     ['function_declaration', 'anonymous_function'],
}

const PARAM_NODES: Record<string, string> = {
  javascript: 'formal_parameters',
  typescript: 'formal_parameters',
  python:     'parameters',
  java:       'formal_parameters',
  kotlin:     'function_value_parameters',
}

function countParams(node: any, paramNodeType: string): number {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child?.type === paramNodeType) {
      return child.namedChildCount ?? 0
    }
  }
  return 0
}

const schema = {
  max: { type: 'number', default: 4, min: 0 },
} satisfies ConfigSchema

export default function (registry: Registry) {
  registry.register('function-max-params', schema, (rc) => ({
    name: `Function exceeds ${rc.max} parameters`,
    description: 'Functions should have a limited number of parameters',
    severity: rc.severity,
    match(node: any, context: Context) {
      const functionNodes = FUNCTION_NODES[context.language]
      if (!functionNodes?.includes(node.type)) return false

      const paramNodeType = PARAM_NODES[context.language]
      if (!paramNodeType) return false

      return countParams(node, paramNodeType) > rc.max
    },
  }))
}