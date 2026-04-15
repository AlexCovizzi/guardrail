import type { RegisterFn, ReportFn, RuleContext, Node } from '../rule.js'

function cyclomaticComplexity(node: Node): number {
  let complexity = 1
  const stack: Node[] = [node]
  while (stack.length > 0) {
    const current = stack.pop()!
    if (current.is('branch')) complexity++
    for (let i = 0; i < current.childCount; i++) {
      const child = current.child(i)
      if (child) stack.push(child)
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
        function(node: Node, ctx: RuleContext, report: ReportFn): void {
          const complexity = cyclomaticComplexity(node)
          if (complexity <= max) return
          report({
            message: `Function has cyclomatic complexity of ${complexity} (max: ${max})`,
          })
        },
      }
    },
  })
}
