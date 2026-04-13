import { resolveSelector } from '../core/engine.js'
import { LANGUAGES, type LanguageDefinition } from '../core/languages.js'
import { parse } from '../core/parser.js'
import type { FileContext, Handler, Rule, SyntaxNode } from '../rules/rule.js'

function nodeMatchesVisitors(
  node: SyntaxNode,
  rule: Omit<Rule, 'id'>,
  langDef: LanguageDefinition,
  context: FileContext
): boolean {
  for (const [rawKey, fn] of Object.entries(rule.visitors) as [string, Handler][]) {
    if (fn == null) continue
    const resolved = resolveSelector(rawKey, langDef)
    for (const { nodeType, isExit } of resolved) {
      if (isExit || nodeType !== node.type) continue
      let matched = false
      const report = () => {
        matched = true
      }
      fn(node, { ...context, report } as any, report)
      if (matched) return true
    }
  }
  return false
}

export async function matchesAnyNode(
  rule: Omit<Rule, 'id'>,
  source: string,
  language: string | LanguageDefinition
): Promise<boolean> {
  const langDef = typeof language === 'string' ? LANGUAGES[language] : language
  if (!langDef) return false
  const tree = await parse(source, langDef)
  if (!tree) throw new Error('Parse failed')

  const context: FileContext = { source, filename: `file.${langDef.name}`, language: langDef, tree }
  const stack: any[] = [tree.rootNode]

  while (stack.length > 0) {
    const node = stack.pop()!
    if (nodeMatchesVisitors(node as SyntaxNode, rule, langDef, context)) return true
    for (let i = 0; i < node.childCount; i++) stack.push(node.child(i)!)
  }

  return false
}
