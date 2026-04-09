import { parse, detectLanguage } from './parser.js'
import { Config, Context, Result, Violation } from './types.js'
import { loadRules } from '../rules/loader.js'
import { resolveConfigForLanguage } from '../config/resolver.js'

export class Engine {
  constructor(private config: Config) {}

  async check(filename: string, source: string): Promise<Result> {
    const language = detectLanguage(filename)
    const effectiveConfig = resolveConfigForLanguage(this.config, language)
    const rules = await loadRules(effectiveConfig)
    const tree = await parse(source, language)
    if (!tree) throw Error('Error parsing')
    const context: Context = { source, filename, language, tree }
    const violations: Violation[] = []

    const cursor = tree.walk()
    const stack = [cursor.currentNode]

    while (stack.length > 0) {
      const node = stack.pop()!

      for (const rule of rules) {
        if (rule.enabled === false) continue
        if (rule.languages && !rule.languages.includes(context.language)) continue
        if (rule.match(node, context)) {
          violations.push({
            ruleId: rule.id,
            message: rule.name,
            location: {
              start: { line: node.startPosition.row + 1, column: node.startPosition.column },
              end: { line: node.endPosition.row + 1, column: node.endPosition.column },
            },
            severity: rule.severity,
            fix: rule.fix?.(node, context),
          })
        }
      }

      for (let i = 0; i < node.childCount; i++) {
        stack.push(node.child(i)!)
      }
    }

    return {
      filename,
      violations,
      passed: violations.filter((v) => v.severity === 'error').length === 0,
    }
  }
}
