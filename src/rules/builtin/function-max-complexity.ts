import type { FileContext, RegisterFn, ReportFn, SyntaxNode } from '../rule.js'

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

export default function (register: RegisterFn) {
  register('function-max-complexity', {
    description: 'Functions should have low cyclomatic complexity',
    create(config) {
      const max = config.number('max', { default: 10, min: 1 })

      return {
        function(node: SyntaxNode, ctx: FileContext, report: ReportFn): void {
          const branchTypes = new Set(ctx.language.types.branch)
          const complexity = cyclomaticComplexity(node, branchTypes)
          if (complexity <= max) return
          report({
            message: `Function has cyclomatic complexity of ${complexity} (max: ${max})`,
            hint: 'Reduce nesting by extracting branches into separate functions',
          })
        },
      }
    },
  })
}
