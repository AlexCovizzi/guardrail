import { readFileSync } from 'node:fs'
import type { Config } from '../config/config.js'
import type { RuleRegistry } from '../rules/registry.js'
import type { Handler, Location, ReportFn, Rule, RuleContext } from '../rules/rule.js'
import type { Cache } from './cache.js'
import { expandInputs } from './files.js'
import { detectLanguage, type LanguageDefinition, nodeTypesFor } from './language.js'
import type { SemanticKind } from './languages/types.js'
import { Node } from './node.js'
import { ParseError, type Parser } from './parser.js'
import type { ProjectIndex } from './project-index.js'
import type { PerFileTiming, Timer } from './timer.js'

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
  if (k in language.kinds) {
    return nodeTypesFor(language, k as SemanticKind).map((nodeType) => ({ nodeType, isExit }))
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

interface WalkResult {
  violations: Violation[]
  nodesVisited: number
  perRule: Map<string, number>
}

function walkTree(tree: any, dispatchMap: DispatchMap, context: RuleContext, doTiming: boolean): WalkResult {
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
      dispatchEntries(entries, rawNode, { context, violations, perRule, doTiming })
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
  ctx: { context: RuleContext; violations: Violation[]; perRule: Map<string, number>; doTiming: boolean }
): void {
  const { context, violations, perRule, doTiming } = ctx
  const node = new Node(rawNode, context.language)
  for (const { rule, fn } of entries) {
    const report: ReportFn = ({ message }) => {
      violations.push({
        ruleId: rule.id,
        message,
        description: rule.description,
        location: {
          start: { line: rawNode.startPosition.row + 1, column: rawNode.startPosition.column },
          end: { line: rawNode.endPosition.row + 1, column: rawNode.endPosition.column },
        },
        severity: rule.severity,
      })
    }
    if (doTiming) {
      const start = performance.now()
      fn(node, context, report)
      perRule.set(rule.id, (perRule.get(rule.id) ?? 0) + (performance.now() - start))
    } else {
      fn(node, context, report)
    }
  }
}

function updateMetrics(t: Timer, fileTimings: PerFileTiming[], totalFiles: number, changedFiles: number): void {
  const metrics = t.getMetrics()
  metrics.perFile = fileTimings
  metrics.totalFiles = totalFiles
  metrics.changedFiles = changedFiles
  metrics.cacheHitRate = totalFiles > 0 ? (totalFiles - changedFiles) / totalFiles : 0
}

export class Engine {
  constructor(
    private parser: Parser,
    private config: Config,
    private cache: Cache,
    private registry: RuleRegistry,
    private timer: Timer
  ) {}

  setTimer(timer: Timer): void {
    this.timer = timer
  }

  async check(targets: string[]): Promise<Result[]> {
    const t = this.timer
    const ignore = this.config.getIgnorePatterns()

    const projectFiles = expandInputs(['.'], ignore)
    const expanded = expandInputs(targets, ignore)
    const { changed, deleted } = this.cache.diff(projectFiles)

    this.cache.removeDeleted(deleted)

    const index = this.cache.getIndex()
    const doTiming = !!t

    await this.timer.measure('parse.changed', async () => {
      for (const file of changed) {
        await this.indexFile(file)
      }
    })
    this.timer.measure('cache.write', () => this.cache.write())

    const fileTimings: PerFileTiming[] = []
    const results: Result[] = []

    await this.timer.measure('check.files', async () => {
      const rs = await Promise.all(expanded.map((file) => this.checkFile(file, index, doTiming)))
      for (const r of rs) {
        if (!r) continue
        results.push(r.result)
        if (r.timing) fileTimings.push(r.timing)
      }
    })

    if (t) updateMetrics(t, fileTimings, projectFiles.length, changed.length)

    return results
  }

  /** Parse and index a changed file into ProjectIndex, then free the tree. */
  private async indexFile(file: string): Promise<void> {
    const language = detectLanguage(file)
    if (!language) return

    const source = readFileSync(file, 'utf-8')
    const tree = await this.parser.parse(file, source)
    this.cache.updateChanged([{ filename: file, source, language, tree }])

    if (tree && typeof tree.delete === 'function') tree.delete()
  }

  /** Parse, check, and free one file. Returns null if the file can't be parsed. */
  private async checkFile(
    file: string,
    index: ProjectIndex,
    doTiming: boolean
  ): Promise<{ result: Result; timing: PerFileTiming | undefined } | null> {
    const language = detectLanguage(file)
    if (!language) return { result: { filename: file, violations: [], passed: true }, timing: undefined }

    let source: string
    let tree: any
    let parseMs = 0
    try {
      source = readFileSync(file, 'utf-8')
      const parseStart = doTiming ? performance.now() : 0
      tree = await this.parser.parse(file, source)
      if (doTiming) parseMs = performance.now() - parseStart
    } catch (err) {
      if (err instanceof ParseError) {
        process.stderr.write(`guardrail: ${err.message}\n`)
        return null
      }
      throw err
    }

    const out = this.checkTree({ filename: file, source, language }, tree, { index, doTiming, parseMs })
    if (tree && typeof tree.delete === 'function') tree.delete()
    return out
  }

  /** Check an already-parsed tree against rules. No file I/O or parsing. */
  private checkTree(
    file: {
      filename: string
      source: string
      language: LanguageDefinition
    },
    tree: any,
    treeCtx: { index: ProjectIndex; doTiming: boolean; parseMs: number }
  ): { result: Result; timing: PerFileTiming | undefined } {
    const { index, doTiming, parseMs } = treeCtx
    const rulesStart = performance.now()
    const rules = this.registry
      .createRules(this.config.forFile(file.filename))
      .filter((r) => !r.languages || r.languages.includes(file.language.name))
    const createRulesMs = doTiming ? performance.now() - rulesStart : 0

    if (rules.length === 0) {
      return { result: { filename: file.filename, violations: [], passed: true }, timing: undefined }
    }

    const dispatchStart = performance.now()
    const dispatchMap = buildDispatchMap(rules, file.language)
    const buildDispatchMs = doTiming ? performance.now() - dispatchStart : 0

    const name = file.filename
    const ctx: RuleContext = { source: file.source, filename: name, language: file.language, project: index }
    const walkStart = performance.now()
    const { violations, nodesVisited, perRule } = walkTree(tree, dispatchMap, ctx, doTiming)
    const walkMs = doTiming ? performance.now() - walkStart : 0

    const lines = file.source.split('\n').length
    const chars = file.source.length
    const timing: PerFileTiming | undefined = doTiming
      ? {
          filename: name,
          lines,
          chars,
          nodesVisited,
          parseMs,
          createRulesMs,
          buildDispatchMs,
          walkMs,
          totalMs: parseMs + createRulesMs + buildDispatchMs + walkMs,
          perRule,
        }
      : undefined

    return {
      result: {
        filename: file.filename,
        violations,
        passed: violations.filter((v) => v.severity === 'error').length === 0,
      },
      timing,
    }
  }
}
