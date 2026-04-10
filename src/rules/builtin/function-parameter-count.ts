import { Registry, SyntaxNode, RuleContext } from '../../core/types.js'

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

const ALL_FUNCTION_TYPES = [...new Set(Object.values(FUNCTION_NODES).flat())]

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}

function countParams(node: SyntaxNode, paramNodeType: string): number {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child?.type === paramNodeType) {
      return child.namedChildCount ?? 0
    }
  }
  return 0
}

export default function (registry: Registry) {
  registry.register('function-max-params', {
    description: 'Functions should have a limited number of parameters',
    create(config) {
      const max = config.number('max', { default: 4, min: 0 })

      function check(node: SyntaxNode, ctx: RuleContext): void {
        const functionNodes = FUNCTION_NODES[ctx.language]
        if (!functionNodes?.includes(node.type)) return

        const paramNodeType = PARAM_NODES[ctx.language]
        if (!paramNodeType) return

        const count = countParams(node, paramNodeType)
        if (count <= max) return
        ctx.report({
          message: `Function has ${count} parameters (max: ${max})`,
          hint: 'Group related parameters into an options object',
        })
      }

      return Object.fromEntries(ALL_FUNCTION_TYPES.map((t) => [`_${snakeToCamel(t)}`, check]))
    },
  })
}
