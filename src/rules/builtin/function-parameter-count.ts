import { Registry, Context, ConfigSchema, Report } from '../../core/types.js'

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
    description: 'Functions should have a limited number of parameters',
    severity: rc.severity,
    match(node: any, context: Context, report: Report): void {
      const functionNodes = FUNCTION_NODES[context.language]
      if (!functionNodes?.includes(node.type)) return

      const paramNodeType = PARAM_NODES[context.language]
      if (!paramNodeType) return

      const count = countParams(node, paramNodeType)
      if (count <= rc.max) return
      report({
        message: `Function has ${count} parameters (max: ${rc.max})`,
        hint: 'Group related parameters into an options object',
      })
    },
  }))
}