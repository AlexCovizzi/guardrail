import { parse } from './parser.js'
import { Config, Context, RuleContext, Result, Rule, VisitorFn, Violation } from './types.js'
import { loadRules } from '../rules/loader.js'
import { resolveConfigForLanguage } from '../config/resolver.js'
import { LanguageDefinition, SemanticTypeName } from './languages.js'
import { detectLanguage } from './languages.js'

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

export function resolveVisitorKey(key: string, language: LanguageDefinition): Array<{ nodeType: string; isExit: boolean }> {
  let isExit = false
  let k = key
  if (k.endsWith('Exit')) {
    k = k.slice(0, -4)
    isExit = true
  }
  if (k.startsWith('_')) {
    return [{ nodeType: camelToSnake(k.slice(1)), isExit }]
  }
  if (k in language.types) {
    return (language.types[k as SemanticTypeName] as readonly string[]).map((nodeType) => ({ nodeType, isExit }))
  }
  return []
}

type DispatchEntry = { rule: Rule; fn: VisitorFn }
type DispatchMap = Map<string, DispatchEntry[]>

function buildDispatchMap(rules: Rule[], language: LanguageDefinition): DispatchMap {
  const map: DispatchMap = new Map()
  for (const rule of rules) {
    for (const [rawKey, fn] of Object.entries(rule.visitors)) {
      if (fn == null) continue
      const resolved = resolveVisitorKey(rawKey, language)
      for (const { nodeType, isExit } of resolved) {
        const key = isExit ? `${nodeType}:exit` : nodeType
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push({ rule, fn })
      }
    }
  }
  return map
}

export class Engine {
  constructor(private config: Config) {}

  async check(filename: string, source: string): Promise<Result> {
    const language = detectLanguage(filename)
    const effectiveConfig = resolveConfigForLanguage(this.config, language.name)
    const rules = await loadRules(effectiveConfig)
    const tree = await parse(source, language)
    if (!tree) throw Error('Error parsing')
    const context: Context = { source, filename, language, tree }
    const violations: Violation[] = []

    const activeRules = rules.filter((r) => r.enabled !== false && (!r.languages || r.languages.includes(language.name)))
    const dispatchMap = buildDispatchMap(activeRules, language)

    const stack: Array<[any, boolean]> = [[tree.walk().currentNode, false]]

    while (stack.length > 0) {
      const [node, isExit] = stack.pop()!
      const key = isExit ? `${node.type}:exit` : node.type
      const entries = dispatchMap.get(key)

      if (entries) {
        for (const { rule, fn } of entries) {
          const ctx: RuleContext = {
            ...context,
            report({ message, hint }) {
              violations.push({
                ruleId: rule.id,
                message,
                description: rule.description,
                location: {
                  start: { line: node.startPosition.row + 1, column: node.startPosition.column },
                  end: { line: node.endPosition.row + 1, column: node.endPosition.column },
                },
                severity: rule.severity,
                hint,
              })
            },
          }
          fn(node, ctx)
        }
      }

      if (!isExit) {
        stack.push([node, true])
        for (let i = node.childCount - 1; i >= 0; i--) {
          stack.push([node.child(i)!, false])
        }
      }
    }

    return {
      filename,
      violations,
      passed: violations.filter((v) => v.severity === 'error').length === 0,
    }
  }
}
