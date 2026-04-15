import { resolveSelector } from '../core/engine.js'
import type { LanguageDefinition } from '../core/language.js'
import { Node } from '../core/node.js'
import { Parser } from '../core/parser.js'
import type { Handler, Rule, RuleContext } from '../rules/rule.js'
import { findLanguage } from './fixtures.js'

let parserInstance: Parser | null = null

async function getParser(): Promise<Parser> {
  if (!parserInstance) {
    parserInstance = await Parser.load()
  }
  return parserInstance
}

function buildDispatchMap(
  visitors: Partial<Record<string, Handler>>,
  langDef: LanguageDefinition
): Map<string, Handler[]> {
  const map = new Map<string, Handler[]>()
  for (const [rawKey, fn] of Object.entries(visitors) as [string, Handler | undefined][]) {
    if (fn == null) continue
    for (const { nodeType, isExit } of resolveSelector(rawKey, langDef)) {
      const key = isExit ? `${nodeType}:exit` : nodeType
      if (!map.has(key)) map.set(key, [])
      map.get(key)?.push(fn)
    }
  }
  return map
}

function collectHandlers(
  node: Node,
  isExit: boolean,
  dispatchMap: Map<string, Handler[]>,
  context: RuleContext
): string[] {
  const key = isExit ? `${node.type}:exit` : node.type
  const handlers = dispatchMap.get(key)
  if (!handlers) return []
  const messages: string[] = []
  for (const handler of handlers) {
    handler(node, context, ({ message }) => {
      messages.push(message)
    })
  }
  return messages
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
  const dispatchMap = buildDispatchMap(rule.visitors, langDef)
  const root = new Node(tree.rootNode, langDef)
  const messages: string[] = []
  const stack: Array<[Node, boolean]> = [[root, false]]

  while (stack.length > 0) {
    const [node, isExit] = stack.pop()!
    messages.push(...collectHandlers(node, isExit, dispatchMap, context))
    if (!isExit) {
      stack.push([node, true])
      for (let i = node.childCount - 1; i >= 0; i--) {
        const child = node.child(i)
        if (child) stack.push([child, false])
      }
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
