import { readFileSync } from 'node:fs'
import type { Config } from '../config/config.js'
import type { RuleRegistry } from '../rules/registry.js'
import type { Handler, Location, ReportFn, Rule, RuleContext } from '../rules/rule.js'
import type { Cache } from './cache.js'
import { expandInputs } from './files.js'
import { detectLanguage, type LanguageDefinition, nodeTypesFor } from './language.js'
import type { SemanticKind } from './languages/types.js'
import { ParseError, type Parser } from './parser.js'
import type { ProjectIndex } from './project-index.js'
import { Node } from './node.js'

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

export class Engine {
  constructor(
    private parser: Parser,
    private config: Config,
    private cache: Cache,
    private registry: RuleRegistry
  ) {}

  async check(targets: string[]): Promise<Result[]> {
    const projectFiles = expandInputs(['.'], this.config.getIgnorePatterns())
    const expanded = expandInputs(targets, this.config.getIgnorePatterns())
    const { changed, deleted } = this.cache.diff(projectFiles)

    // Parse changed files
    const changedData = (
      await Promise.all(
        changed.map(async (file) => {
          try {
            const language = detectLanguage(file)
            if (!language) return null

            const source = readFileSync(file, 'utf-8')
            const tree = await this.parser.parse(file, source)

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

    this.cache.updateChanged(changedData)
    this.cache.removeDeleted(deleted)
    this.cache.write()

    const index = this.cache.getIndex()
    const changedSources = new Map(changedData.map((d) => [d.filename, d.source]))

    // Run rules on target files only, reusing already-read source for changed files
    return (
      await Promise.all(
        expanded.map(async (file) => {
          try {
            const source = changedSources.get(file)
            if (source !== undefined) {
              return await this.checkFileWithSource(file, source, index)
            }
            return await this.checkFile(file, index)
          } catch (err) {
            if (err instanceof ParseError) {
              process.stderr.write(`guardrail: ${err.message}\n`)
              return null
            }
            throw err
          }
        })
      )
    ).filter((r): r is Result => r !== null)
  }

  private async checkFile(filename: string, index: ProjectIndex): Promise<Result> {
    const source = readFileSync(filename, 'utf-8')
    return this.checkFileWithSource(filename, source, index)
  }

  private async checkFileWithSource(filename: string, source: string, index: ProjectIndex): Promise<Result> {
    const language = detectLanguage(filename)
    if (!language) return { filename, violations: [], passed: true }
    const rules = this.registry
      .createRules(this.config.forFile(filename))
      .filter((r) => !r.languages || r.languages.includes(language.name))
    const tree = await this.parser.parse(filename, source)
    const context: RuleContext = { source, filename, language, project: index }
    const violations: Violation[] = []
    const dispatchMap = buildDispatchMap(rules, language)

    const stack: Array<[any, boolean]> = []
    stack.push([tree.rootNode, false])

    while (stack.length > 0) {
      const [rawNode, isExit] = stack.pop()!
      const key = isExit ? `${rawNode.type}:exit` : rawNode.type
      const entries = dispatchMap.get(key)

      if (entries) {
        const node = new Node(rawNode, language)
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
          fn(node, context, report)
        }
      }

      if (!isExit) {
        stack.push([rawNode, true])
        for (let i = rawNode.childCount - 1; i >= 0; i--) {
          const child = rawNode.child(i)
          if (child) stack.push([child, false])
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