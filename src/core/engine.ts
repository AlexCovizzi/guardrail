import { readFileSync } from 'node:fs'
import type { Config } from '../config/config.js'
import type { RuleRegistry } from '../rules/registry.js'
import type { Handler, Location, ReportFn, Rule, RuleContext } from '../rules/rule.js'
import { expandInputs } from './files.js'
import { detectLanguage, type LanguageDefinition } from './language.js'
import type { NodePattern } from './languages/types.js'
import { Node } from './node.js'
import { ParseError, type Parser } from './parser.js'
import type { Timer } from './timer.js'

// --- Non-export declarations (wildcard position in declaration order) ---

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

type DispatchEntry = { rule: Rule; fn: Handler; pattern?: NodePattern }
type DispatchMap = Map<string, DispatchEntry[]>

function buildDispatchMap(rules: Rule[], language: LanguageDefinition): DispatchMap {
  const map: DispatchMap = new Map()
  for (const rule of rules) {
    for (const [rawKey, fn] of Object.entries(rule.visitors)) {
      if (fn == null) continue
      const resolved = resolveSelector(rawKey, language)
      for (const { nodeType, isExit, pattern } of resolved) {
        const key = isExit ? `${nodeType}:exit` : nodeType
        if (!map.has(key)) map.set(key, [])
        map.get(key)?.push({ rule, fn, pattern })
      }
    }
  }
  return map
}

interface WalkResult {
  violations: Violation[]
  nodesVisited: number
  perRule: Map<string, number>
}

function walkTree(tree: any, dispatchMap: DispatchMap, context: RuleContext): WalkResult {
  const violations: Violation[] = []
  const perRule = new Map<string, number>()
  let nodesVisited = 0
  const stack: Array<[any, boolean]> = [[tree.rootNode, false]]

  while (stack.length > 0) {
    const [rawNode, isExit] = stack.pop()!
    const key = isExit ? `${rawNode.type}:exit` : rawNode.type
    const entries = dispatchMap.get(key)
    nodesVisited++

    if (entries) {
      dispatchEntries(entries, rawNode, { context, violations, perRule })
    }

    if (!isExit) {
      stack.push([rawNode, true])
      for (let i = rawNode.childCount - 1; i >= 0; i--) {
        const child = rawNode.child(i)
        if (child) stack.push([child, false])
      }
    }
  }

  return { violations, nodesVisited, perRule }
}

function dispatchEntries(
  entries: DispatchEntry[],
  rawNode: any,
  ctx: { context: RuleContext; violations: Violation[]; perRule: Map<string, number> }
): void {
  const { context, violations, perRule } = ctx
  const node = new Node(rawNode, context.language)
  for (const { rule, fn, pattern } of entries) {
    // Skip if the node doesn't satisfy the selector's hasChild/lacksChild constraints
    if (pattern && !node.matchesPattern(pattern)) continue
    const report: ReportFn = ({ message, suggestion, node: reportNode }) => {
      const target = reportNode ? reportNode.unwrap() : rawNode
      violations.push({
        ruleId: rule.id,
        message,
        suggestion,
        description: rule.description,
        location: {
          start: { line: target.startPosition.row + 1, column: target.startPosition.column },
          end: { line: target.endPosition.row + 1, column: target.endPosition.column },
        },
        severity: rule.severity,
      })
    }
    const start = performance.now()
    fn(node, context, report)
    perRule.set(rule.id, (perRule.get(rule.id) ?? 0) + (performance.now() - start))
  }
}

interface ParsedFile {
  filename: string
  source: string
  language: LanguageDefinition | null
  tree: any
  lines: number
  chars: number
}

// --- Export declarations (export position in declaration order) ---

export interface Violation {
  ruleId: string
  message: string
  suggestion?: string
  description: string
  location: Location
  severity: 'error' | 'warning'
}

export interface Result {
  filename: string
  violations: Violation[]
  passed: boolean
}

export function resolveSelector(
  key: string,
  language: LanguageDefinition
): Array<{ nodeType: string; isExit: boolean; pattern?: NodePattern }> {
  let isExit = false
  let k = key
  if (k.endsWith('Exit')) {
    k = k.slice(0, -4)
    isExit = true
  }
  if (k.startsWith('_')) {
    return [{ nodeType: camelToSnake(k.slice(1)), isExit }]
  }
  if (k in language.kinds) {
    const patterns = language.kinds[k as keyof typeof language.kinds]
    if (!patterns) return []
    return patterns.map((p) => ({
      nodeType: p.type,
      isExit,
      pattern: p.hasChild || p.lacksChild ? p : undefined,
    }))
  }
  return []
}

export class Engine {
  constructor(
    private parser: Parser,
    private config: Config,
    private registry: RuleRegistry,
    private timer: Timer
  ) {}

  async check(targets: string[]): Promise<Result[]> {
    const ignore = this.config.getIgnorePatterns()
    const expanded = expandInputs(targets, ignore)

    const results: Result[] = []

    await this.timer.measure('check.files', async () => {
      // Parse all files in parallel (only truly async phase)
      const parsed = await this.timer.measure('parse', async () =>
        Promise.all(expanded.map((file) => this.parseFile(file)))
      )

      // Process parsed results sequentially — clean timing, no concurrency inflation
      for (const entry of parsed) {
        if (!entry) continue
        const result = this.checkTree(entry)
        this.timer.addFileStats(entry.lines, entry.chars, result.nodesVisited)
        results.push(result.result)
        if (entry.tree && typeof entry.tree.delete === 'function') entry.tree.delete()
      }
    })

    return results
  }

  private async parseFile(file: string): Promise<ParsedFile | null> {
    const language = detectLanguage(file)
    if (!language) return { filename: file, source: '', language, tree: null, lines: 0, chars: 0 }

    let source: string
    let tree: any
    try {
      source = readFileSync(file, 'utf-8')
      tree = await this.parser.parse(file, source)
    } catch (err) {
      if (err instanceof ParseError) {
        process.stderr.write(`guardrail: ${err.message}\n`)
        return null
      }
      throw err
    }

    const lines = source.split('\n').length
    const chars = source.length
    return { filename: file, source, language, tree, lines, chars }
  }

  private checkTree(file: ParsedFile): { result: Result; nodesVisited: number } {
    if (!file.language || !file.tree) {
      return {
        result: { filename: file.filename, violations: [], passed: true },
        nodesVisited: 0,
      }
    }

    const { language, tree, filename, source } = file

    const rules = this.timer.measure('createRules', () =>
      this.registry
        .createRules(this.config.forFile(filename))
        .filter((r) => !r.languages || r.languages.includes(language.name))
    )

    if (rules.length === 0) {
      return {
        result: { filename, violations: [], passed: true },
        nodesVisited: 0,
      }
    }

    const dispatchMap = this.timer.measure('buildDispatch', () => buildDispatchMap(rules, language))

    const ctx: RuleContext = {
      source,
      filename,
      language,
    }
    const { violations, nodesVisited, perRule } = this.timer.measure('walk', () => walkTree(tree, dispatchMap, ctx))

    for (const [ruleId, ms] of perRule) {
      this.timer.addRuleTime(ruleId, ms)
    }

    return {
      result: {
        filename,
        violations,
        passed: violations.filter((v) => v.severity === 'error').length === 0,
      },
      nodesVisited,
    }
  }
}
