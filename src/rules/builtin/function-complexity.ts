import { Registry, SyntaxNode, RuleContext } from '../../core/types.js'

const BRANCH_NODES: Record<string, string[]> = {
  javascript: [
    'if_statement',
    'for_statement',
    'for_in_statement',
    'for_of_statement',
    'while_statement',
    'do_statement',
    'switch_case',
    'catch_clause',
    'ternary_expression',
  ],
  typescript: [
    'if_statement',
    'for_statement',
    'for_in_statement',
    'for_of_statement',
    'while_statement',
    'do_statement',
    'switch_case',
    'catch_clause',
    'ternary_expression',
  ],
  python: [
    'if_statement',
    'elif_clause',
    'for_statement',
    'while_statement',
    'except_clause',
    'conditional_expression',
  ],
  java: [
    'if_statement',
    'for_statement',
    'enhanced_for_statement',
    'while_statement',
    'do_statement',
    'switch_label',
    'catch_clause',
    'ternary_expression',
  ],
  kotlin: ['if_expression', 'for_statement', 'while_statement', 'do_while_statement', 'when_entry', 'catch_block'],
}

function cyclomaticComplexity(node: SyntaxNode, branchTypes: Set<string>): number {
  let complexity = 1
  const stack: SyntaxNode[] = [node]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (branchTypes.has(current.type)) complexity++
    for (let i = 0; i < current.childCount; i++) {
      stack.push(current.child(i)!)
    }
  }
  return complexity
}

export default function (registry: Registry) {
  registry.register('function-max-complexity', {
    description: 'Functions should have low cyclomatic complexity',
    create(config) {
      const max = config.number('max', { default: 10, min: 1 })

      function check(node: SyntaxNode, ctx: RuleContext): void {
        const branchTypes = new Set(BRANCH_NODES[ctx.language] ?? [])
        const complexity = cyclomaticComplexity(node, branchTypes)
        if (complexity <= max) return
        ctx.report({
          message: `Function has cyclomatic complexity of ${complexity} (max: ${max})`,
          hint: 'Reduce nesting by extracting branches into separate functions',
        })
      }

      return {
        _functionDeclaration: check,
        _functionDefinition: check,
        _functionExpression: check,
        _arrowFunction: check,
        _methodDeclaration: check,
        _methodDefinition: check,
        _constructorDeclaration: check,
        _anonymous_function: check,
      }
    },
  })
}
