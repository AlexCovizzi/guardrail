import { RuleConfig } from '../config/rule-config.js'
import { resolveSelector } from '../core/engine.js'
import type { LanguageDefinition } from '../core/language.js'
import type { NodePattern } from '../core/languages/types.js'
import { Node } from '../core/node.js'
import { Parser } from '../core/parser.js'
import { registerBuiltins } from '../rules/builtin/index.js'
import { RuleRegistry } from '../rules/registry.js'
import type { Handler, Rule, RuleContext, RuleDefinition } from '../rules/rule.js'
import { findLanguage } from './fixtures.js'

let parserInstance: Parser | null = null

async function getParser(): Promise<Parser> {
  if (!parserInstance) {
    parserInstance = await Parser.load()
  }
  return parserInstance
}

type TestDispatchEntry = { fn: Handler; pattern?: NodePattern }

function buildDispatchMap(
  visitors: Partial<Record<string, Handler>>,
  langDef: LanguageDefinition
): Map<string, TestDispatchEntry[]> {
  const map = new Map<string, TestDispatchEntry[]>()
  for (const [rawKey, fn] of Object.entries(visitors) as [string, Handler | undefined][]) {
    if (fn == null) continue
    for (const { nodeType, isExit, pattern } of resolveSelector(rawKey, langDef)) {
      const key = isExit ? `${nodeType}:exit` : nodeType
      if (!map.has(key)) map.set(key, [])
      map.get(key)?.push({ fn, pattern })
    }
  }
  return map
}

function collectHandlers(
  node: Node,
  isExit: boolean,
  dispatchMap: Map<string, TestDispatchEntry[]>,
  context: RuleContext
): string[] {
  const key = isExit ? `${node.type}:exit` : node.type
  const entries = dispatchMap.get(key)
  if (!entries) return []
  const messages: string[] = []
  for (const { fn, pattern } of entries) {
    // Skip if the node doesn't satisfy hasChild/lacksChild constraints
    if (pattern && !node.matchesPattern(pattern)) continue
    fn(node, context, ({ message }) => {
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

export function getBuiltinRule(
  ruleId: string,
  config: Record<string, any> = {}
): Omit<Rule, 'id'> & { definition: RuleDefinition } {
  const registry = new RuleRegistry()
  registerBuiltins(registry.register.bind(registry))
  const entry = registry.getEntries().find((e) => e.ruleId === ruleId)
  if (!entry) throw new Error(`Unknown builtin rule: ${ruleId}`)
  const builder = new RuleConfig(ruleId, config)
  return {
    description: entry.definition.description,
    severity: (entry.definition.defaultSeverity ?? 'error') as 'error' | 'warning',
    visitors: entry.definition.create(builder),
    definition: entry.definition,
  }
}
