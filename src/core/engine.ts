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

type ChangedData = { filename: string; source: string; language: LanguageDefinition; tree: any }

async function parseChangedFiles(parser: Parser, changed: string[]): Promise<ChangedData[]> {
  return (
    await Promise.all(
      changed.map(async (file) => {
        try {
          const language = detectLanguage(file)
          if (!language) return null
          const source = readFileSync(file, 'utf-8')
          const tree = await parser.parse(file, source)
          return { filename: file, source, language, tree }
        } catch (err) {
          if (err instanceof ParseError) {
            process.stderr.write(`guardrail: ${err.message}\n`)
            return null
          }
          throw err
        }
      })
    )
  ).filter((d): d is NonNullable<typeof d> => d !== null)
}

async function processFile(
  file: string,
  changedSources: Map<string, string>,
  index: ProjectIndex,
  engine: Engine
): Promise<{ result: Result; timing: PerFileTiming | undefined } | null> {
  try {
    const source = changedSources.get(file)
    if (source !== undefined) {
      return await engine.checkFileWithSource(file, source, index)
    }
    return await engine.checkFile(file, index)
  } catch (err) {
    if (err instanceof ParseError) {
      process.stderr.write(`guardrail: ${err.message}\n`)
      return null
    }
    throw err
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
  private timer: Timer | undefined

  constructor(
    private parser: Parser,
    private config: Config,
    private cache: Cache,
    private registry: RuleRegistry
  ) {}

  setTimer(timer: Timer): void {
    this.timer = timer
  }

  async check(targets: string[]): Promise<Result[]> {
    const t = this.timer
    const ignore = this.config.getIgnorePatterns()

    const projectFiles = this.measured(t, 'file.expand', () => expandInputs(['.'], ignore))
    const expanded = this.measured(t, 'file.expand.targets', () => expandInputs(targets, ignore))
    const { changed, deleted } = this.measured(t, 'cache.diff', () => this.cache.diff(projectFiles))

    const changedData = t
      ? await t.measureAsync('parse.changed', () => parseChangedFiles(this.parser, changed))
      : await parseChangedFiles(this.parser, changed)

    this.cache.updateChanged(changedData)
    this.cache.removeDeleted(deleted)
    this.measured(t, 'cache.write', () => this.cache.write())

    const index = this.cache.getIndex()
    const changedSources = new Map(changedData.map((d) => [d.filename, d.source]))
    const fileTimings: PerFileTiming[] = []

    const results = t
      ? await t.measureAsync('check.files', () =>
          Promise.all(expanded.map((file) => processFile(file, changedSources, index, this))).then((rs) =>
            rs.filter((r): r is { result: Result; timing: PerFileTiming | undefined } => r !== null)
          )
        )
      : (await Promise.all(expanded.map((file) => processFile(file, changedSources, index, this)))).filter(
          (r): r is { result: Result; timing: PerFileTiming | undefined } => r !== null
        )

    const finalResults = results.map((r) => r.result)
    for (const r of results) {
      if (r.timing) fileTimings.push(r.timing)
    }

    if (t) updateMetrics(t, fileTimings, projectFiles.length, changed.length)

    return finalResults
  }

  async checkFile(
    filename: string,
    index: ProjectIndex
  ): Promise<{ result: Result; timing: PerFileTiming | undefined }> {
    const source = readFileSync(filename, 'utf-8')
    return this.checkFileWithSource(filename, source, index)
  }

  async checkFileWithSource(
    filename: string,
    source: string,
    index: ProjectIndex
  ): Promise<{ result: Result; timing: PerFileTiming | undefined }> {
    const doTiming = !!this.timer
    const language = detectLanguage(filename)
    if (!language) {
      return { result: { filename, violations: [], passed: true }, timing: undefined }
    }

    const rulesStart = performance.now()
    const rules = this.registry
      .createRules(this.config.forFile(filename))
      .filter((r) => !r.languages || r.languages.includes(language.name))
    const createRulesMs = doTiming ? performance.now() - rulesStart : 0

    const parseStart = performance.now()
    const tree = await this.parser.parse(filename, source)
    const parseMs = doTiming ? performance.now() - parseStart : 0

    const dispatchStart = performance.now()
    const dispatchMap = buildDispatchMap(rules, language)
    const buildDispatchMs = doTiming ? performance.now() - dispatchStart : 0

    const context: RuleContext = { source, filename, language, project: index }
    const walkStart = performance.now()
    const { violations, nodesVisited, perRule } = walkTree(tree, dispatchMap, context, doTiming)
    const walkMs = doTiming ? performance.now() - walkStart : 0

    const totalMs = createRulesMs + parseMs + buildDispatchMs + walkMs
    const lines = source.split('\n').length
    const chars = source.length
    const timing: PerFileTiming | undefined = doTiming
      ? { filename, lines, chars, nodesVisited, parseMs, createRulesMs, buildDispatchMs, walkMs, totalMs, perRule }
      : undefined

    return {
      result: {
        filename,
        violations,
        passed: violations.filter((v) => v.severity === 'error').length === 0,
      },
      timing,
    }
  }

  private measured<T>(t: Timer | undefined, name: string, fn: () => T): T {
    return t ? t.measure(name, fn) : fn()
  }
}
