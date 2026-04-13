import { Config } from '../config/config.js'
import { discoverAllRules, instantiateRules } from '../rules/loader.js'
import type { FileContext, Handler, Location, ReportFn, Rule } from '../rules/rule.js'
import { detectLanguage, LANGUAGES, type LanguageDefinition, type SemanticTypeName } from './languages.js'
import { ParseError, parse } from './parser.js'

export interface Violation {
  ruleId: string
  message: string
  description: string
  location: Location
  severity: 'error' | 'warning'
}

export interface Result {
  filename: string
  violations: Violation[]
  passed: boolean
}

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

export function resolveSelector(
  key: string,
  language: LanguageDefinition
): Array<{ nodeType: string; isExit: boolean }> {
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

type DispatchEntry = { rule: Rule; fn: Handler }
type DispatchMap = Map<string, DispatchEntry[]>

function buildDispatchMap(rules: Rule[], language: LanguageDefinition): DispatchMap {
  const map: DispatchMap = new Map()
  for (const rule of rules) {
    for (const [rawKey, fn] of Object.entries(rule.visitors)) {
      if (fn == null) continue
      const resolved = resolveSelector(rawKey, language)
      for (const { nodeType, isExit } of resolved) {
        const key = isExit ? `${nodeType}:exit` : nodeType
        if (!map.has(key)) map.set(key, [])
        map.get(key)?.push({ rule, fn })
      }
    }
  }
  return map
}

export class Engine {
  private constructor(
    private rulesByLanguage: Map<string, Rule[]>,
    private ignorePatterns: string[]
  ) {}

  static async create(cwd?: string): Promise<Engine> {
    const config = Config.load(cwd)
    const registry = await discoverAllRules()

    const knownIds = new Set(registry.getEntries().map((e) => e.ruleId))
    for (const id of config.getConfiguredRuleIds()) {
      if (!knownIds.has(id)) {
        process.stderr.write(`guardrail: unknown rule "${id}" in config\n`)
      }
    }

    const rulesByLanguage = new Map<string, Rule[]>()
    for (const lang of Object.values(LANGUAGES)) {
      rulesByLanguage.set(lang.name, instantiateRules(registry, config.forLanguage(lang.name)))
    }
    return new Engine(rulesByLanguage, config.getIgnorePatterns())
  }

  static createWithRules(rulesByLanguage: Map<string, Rule[]>): Engine {
    return new Engine(rulesByLanguage, [])
  }

  getIgnorePatterns(): string[] {
    return this.ignorePatterns
  }

  async check(filename: string, source: string): Promise<Result> {
    const language = detectLanguage(filename)
    const rules = this.rulesByLanguage.get(language.name) ?? []
    const tree = await parse(source, language, filename)
    const context: FileContext = { source, filename, language, tree }
    const violations: Violation[] = []

    const activeRules = rules.filter(
      (r) => r.enabled !== false && (!r.languages || r.languages.includes(language.name))
    )
    const dispatchMap = buildDispatchMap(activeRules, language)

    const stack: Array<[any, boolean]> = [[tree.walk().currentNode, false]]

    while (stack.length > 0) {
      const [node, isExit] = stack.pop()!
      const key = isExit ? `${node.type}:exit` : node.type
      const entries = dispatchMap.get(key)

      if (entries) {
        for (const { rule, fn } of entries) {
          const report: ReportFn = ({ message }) => {
            violations.push({
              ruleId: rule.id,
              message,
              description: rule.description,
              location: {
                start: { line: node.startPosition.row + 1, column: node.startPosition.column },
                end: { line: node.endPosition.row + 1, column: node.endPosition.column },
              },
              severity: rule.severity,
            })
          }
          fn(node, { ...context }, report)
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
