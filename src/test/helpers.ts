import { RuleConfig } from '../config/rule-config.js'
import { RuleDispatcher } from '../core/dispatcher.js'
import type { LanguageDefinition } from '../core/language.js'
import { Parser } from '../core/parser.js'
import { registerBuiltins } from '../rules/builtin/index.js'
import { RuleRegistry } from '../rules/registry.js'
import type { Rule, RuleContext, RuleDefinition } from '../rules/rule.js'
import { findLanguage } from './fixtures.js'

let parserInstance: Parser | null = null

async function getParser(): Promise<Parser> {
  if (!parserInstance) {
    parserInstance = await Parser.load()
  }
  return parserInstance
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

  const fullRule: Rule = {
    id: 'test-rule',
    description: rule.description,
    severity: rule.severity,
    visitors: rule.visitors,
  }

  const dispatcher = new RuleDispatcher([fullRule], langDef)
  const result = dispatcher.walk(tree, context)
  return result.violations.map((v) => v.message)
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
