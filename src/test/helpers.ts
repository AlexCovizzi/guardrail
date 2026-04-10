import { parse } from '../core/parser.js'
import { Context, Rule } from '../core/types.js'

export async function matchesAnyNode(rule: Omit<Rule, 'id'>, source: string, language: string): Promise<boolean> {
  const tree = await parse(source, language)
  if (!tree) throw new Error('Parse failed')

  const context: Context = { source, filename: `file.${language}`, language, tree }
  const stack = [tree.rootNode]

  while (stack.length > 0) {
    const node = stack.pop()!
    let matched = false
    rule.match(node, context, () => { matched = true })
    if (matched) return true
    for (let i = 0; i < node.childCount; i++) stack.push(node.child(i)!)
  }

  return false
}