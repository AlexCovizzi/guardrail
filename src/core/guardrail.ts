import { homedir } from 'node:os'
import process from 'node:process'

import { Config } from '../config/config.js'
import { RuleRegistry } from '../rules/registry.js'
import { Engine, type Result } from './engine.js'
import { Env } from './env.js'
import { Parser } from './parser.js'
import { Timer, type TimingMetrics } from './timer.js'

export class Guardrail {
  private constructor(
    readonly env: Env,
    readonly config: Config,
    readonly registry: RuleRegistry,
    private deps: { parser: Parser; timer: Timer }
  ) {}

  static async load(): Promise<Guardrail> {
    const timer = new Timer()
    const env = Env.create(process.cwd(), homedir())

    const [config, registry, parser] = await timer.measure('startup', async () =>
      Promise.all([
        timer.measure('config.load', () => Config.load(env)),
        timer.measure('registry.load', () => RuleRegistry.load(env)),
        timer.measure('parser.load', () => Parser.load()),
      ])
    )

    validateKnownRules(config, registry)

    return new Guardrail(env, config, registry, { parser, timer })
  }

  async check(targets: string[]): Promise<Result[]> {
    const engine = new Engine(this.deps.parser, this.config, this.registry, this.deps.timer)
    return engine.check(targets)
  }

  listRules(): Array<{ ruleId: string; severity: string; description: string }> {
    return this.registry.getEntries().map(({ ruleId, definition }) => ({
      ruleId,
      severity: definition.defaultSeverity ?? 'error',
      description: definition.description,
    }))
  }

  getMetrics(): TimingMetrics {
    return this.deps.timer.getMetrics()
  }
}

function validateKnownRules(config: Config, ruleRegistry: RuleRegistry): void {
  const knownRuleIds = ruleRegistry.getRuleIds()
  const data = config.toJson()
  const configured = new Set<string>()
  for (const id of Object.keys(data.rules ?? {})) configured.add(id)
  for (const override of Object.values(data.overrides ?? {})) {
    for (const id of Object.keys(override.rules ?? {})) configured.add(id)
  }
  for (const id of configured) {
    if (!knownRuleIds.has(id)) {
      process.stderr.write(`guardrail: unknown rule "${id}"\n`)
    }
  }
}
