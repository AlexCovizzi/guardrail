import { parse } from '../core/parser.js'
import { Context, RuleContext, Rule, SyntaxNode, VisitorFn } from '../core/types.js'
import { resolveVisitorKey } from '../core/engine.js'

export async function matchesAnyNode(rule: Omit<Rule, 'id'>, source: string, language: string): Promise<boolean> {
  const tree = await parse(source, language)
  if (!tree) throw new Error('Parse failed')

  const context: Context = { source, filename: `file.${language}`, language, tree }
  const stack: any[] = [tree.rootNode]

  while (stack.length > 0) {
    const node = stack.pop()!
    for (const [rawKey, fn] of Object.entries(rule.visitors) as [string, VisitorFn][]) {
      const { nodeType, isExit } = resolveVisitorKey(rawKey)
      if (isExit || nodeType !== node.type) continue
      let matched = false
      const ctx: RuleContext = { ...context, report: () => { matched = true } }
      fn(node as SyntaxNode, ctx)
      if (matched) return true
    }
    for (let i = 0; i < node.childCount; i++) stack.push(node.child(i)!)
  }

  return false
}
