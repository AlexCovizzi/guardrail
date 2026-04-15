import { resolveSelector } from '../core/engine.js'
import type { LanguageDefinition } from '../core/language.js'
import { Parser } from '../core/parser.js'
import { Node } from '../core/node.js'
import type { Handler, Rule, RuleContext } from '../rules/rule.js'
import { findLanguage } from './fixtures.js'

function collectNodeViolations(
  node: Node,
  rule: Omit<Rule, 'id'>,
  langDef: LanguageDefinition,
  context: RuleContext
): string[] {
  const messages: string[] = []
  for (const [rawKey, fn] of Object.entries(rule.visitors) as [string, Handler][]) {
    if (fn == null) continue
    const resolved = resolveSelector(rawKey, langDef)
    for (const { nodeType, isExit } of resolved) {
      if (isExit || nodeType !== node.type) continue
      fn(node, context, ({ message }) => {
        messages.push(message)
      })
    }
  }
  return messages
}

let parserInstance: Parser | null = null

async function getParser(): Promise<Parser> {
  if (!parserInstance) {
    parserInstance = await Parser.load()
  }
  return parserInstance
}

export async function collectViolations(
  rule: Omit<Rule, 'id'>,
  source: string,
  language: string | LanguageDefinition
): Promise<string[]> {
  const langDef = typeof language === 'string' ? findLanguage(language) : language
  if (!langDef) return []
  const parser = await getParser()
  const tree = await parser.parse(`file.${langDef.extensions[0]}`, source)
  if (!tree) throw new Error('Parse failed')

  const context: RuleContext = {
    source,
    filename: `file.${langDef.name}`,
    language: langDef,
    project: { search: () => [] },
  }
  const root = new Node(tree.rootNode, langDef)
  const stack: Node[] = [root]
  const messages: string[] = []

  while (stack.length > 0) {
    const node = stack.pop()!
    messages.push(...collectNodeViolations(node, rule, langDef, context))
    for (let i = node.childCount - 1; i >= 0; i--) {
      const child = node.child(i)
      if (child) stack.push(child)
    }
  }

  return messages
}

export async function matchesAnyNode(
  rule: Omit<Rule, 'id'>,
  source: string,
  language: string | LanguageDefinition
): Promise<boolean> {
  const violations = await collectViolations(rule, source, language)
  return violations.length > 0
}
