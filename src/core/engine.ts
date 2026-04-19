import { readFileSync } from 'node:fs'
import type * as TreeSitter from 'web-tree-sitter'
import type { Config } from '../config/config.js'
import type { RuleRegistry } from '../rules/registry.js'
import type { RuleContext } from '../rules/rule.js'
import { RuleDispatcher, type Violation } from './dispatcher.js'
import { expandInputs } from './files.js'
import { detectLanguage, type LanguageDefinition } from './language.js'
import { ParseError, type Parser } from './parser.js'
import type { Timer } from './timer.js'

interface ParsedFile {
  filename: string
  source: string
  language: LanguageDefinition | null
  tree: any
  lines: number
  chars: number
}

export type { Violation }

export interface Result {
  filename: string
  violations: Violation[]
  passed: boolean
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
    let tree: TreeSitter.Tree
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

    const dispatcher = this.timer.measure('buildDispatch', () => new RuleDispatcher(rules, language))

    const ctx: RuleContext = {
      source,
      filename,
      language,
    }
    const { violations, nodesVisited, perRule } = this.timer.measure('walk', () => dispatcher.walk(tree, ctx))

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
