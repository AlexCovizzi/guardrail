import { Registry, ConfigSchema, RuleConfig, ResolvedConfig, Rule } from '../core/types.js'

type Entry = {
  id: string
  schema: ConfigSchema
  create: (config: ResolvedConfig<ConfigSchema>) => Omit<Rule, 'id'>
}

export class RuleRegistry implements Registry {
  private entries: Entry[] = []

  register<S extends ConfigSchema>(
    id: string,
    schema: S,
    create: (config: ResolvedConfig<S>) => Omit<Rule, 'id'>
  ): void {
    this.entries.push({ id, schema, create: create as Entry['create'] })
  }

  getEntries(): Entry[] {
    return this.entries
  }
}