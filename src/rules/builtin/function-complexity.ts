import { Registry, Context, ConfigSchema, Report } from '../../core/types.js'

const FUNCTION_NODES: Record<string, string[]> = {
  javascript: ['function_declaration', 'function_expression', 'arrow_function', 'method_definition'],
  typescript: ['function_declaration', 'function_expression', 'arrow_function', 'method_definition'],
  python:     ['function_definition'],
  java:       ['method_declaration', 'constructor_declaration'],
  kotlin:     ['function_declaration', 'anonymous_function'],
}

const BRANCH_NODES: Record<string, string[]> = {
  javascript: ['if_statement', 'for_statement', 'for_in_statement', 'for_of_statement', 'while_statement', 'do_statement', 'switch_case', 'catch_clause', 'ternary_expression'],
  typescript: ['if_statement', 'for_statement', 'for_in_statement', 'for_of_statement', 'while_statement', 'do_statement', 'switch_case', 'catch_clause', 'ternary_expression'],
  python:     ['if_statement', 'elif_clause', 'for_statement', 'while_statement', 'except_clause', 'conditional_expression'],
  java:       ['if_statement', 'for_statement', 'enhanced_for_statement', 'while_statement', 'do_statement', 'switch_label', 'catch_clause', 'ternary_expression'],
  kotlin:     ['if_expression', 'for_statement', 'while_statement', 'do_while_statement', 'when_entry', 'catch_block'],
}

function cyclomaticComplexity(node: any, branchTypes: Set<string>): number {
  let complexity = 1
  const stack = [node]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (branchTypes.has(current.type)) complexity++
    for (let i = 0; i < current.childCount; i++) {
      stack.push(current.child(i)!)
    }
  }
  return complexity
}

const schema = {
  max: { type: 'number', default: 10, min: 1 },
} satisfies ConfigSchema

export default function(registry: Registry) {
  registry.register('function-max-complexity', schema, (rc) => ({
    description: 'Functions should have low cyclomatic complexity',
    severity: rc.severity,
    match(node: any, context: Context, report: Report): void {
      const functionNodes = FUNCTION_NODES[context.language]
      if (!functionNodes?.includes(node.type)) return

      const branchTypes = new Set(BRANCH_NODES[context.language] ?? [])
      const complexity = cyclomaticComplexity(node, branchTypes)
      if (complexity <= rc.max) return
      report({
        message: `Function has cyclomatic complexity of ${complexity} (max: ${rc.max})`,
        hint: 'Reduce nesting by extracting branches into separate functions',
      })
    },
  }))
}