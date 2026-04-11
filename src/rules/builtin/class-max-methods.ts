import { Registry, SyntaxNode, RuleContext } from '../../core/types.js'

function countMethods(node: SyntaxNode, functionTypes: Set<string>, classTypes: Set<string>): number {
  let count = 0
  const stack: SyntaxNode[] = []

  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child) stack.push(child)
  }

  while (stack.length > 0) {
    const current = stack.pop()!

    if (functionTypes.has(current.type)) {
      count++
      continue // don't recurse into function bodies
    }

    if (classTypes.has(current.type)) {
      continue // don't recurse into nested classes
    }

    for (let i = 0; i < current.childCount; i++) {
      const child = current.child(i)
      if (child) stack.push(child)
    }
  }

  return count
}

export default function (registry: Registry) {
  registry.register('class-max-methods', {
    description: 'Classes should not have too many methods',
    create(config) {
      const max = config.number('max', { default: 20, min: 1 })

      return {
        class(node: SyntaxNode, ctx: RuleContext): void {
          const functionTypes = new Set(ctx.language.types.function)
          const classTypes = new Set(ctx.language.types.class)
          const count = countMethods(node, functionTypes, classTypes)
          if (count <= max) return
          ctx.report({
            message: `Class has ${count} methods (max: ${max})`,
            hint: 'Extract responsibilities into separate classes',
          })
        },
      }
    },
  })
}