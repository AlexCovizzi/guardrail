import { Registry, RuleConfig, Rule } from '../core/types.js'

type Entry = {
  id: string
  create: (config: RuleConfig) => Omit<Rule, 'id'>
}

export class RuleRegistry implements Registry {
  private entries: Entry[] = []

  register(id: string, create: (config: RuleConfig) => Omit<Rule, 'id'>): void {
    this.entries.push({ id, create })
  }

  getEntries(): Entry[] {
    return this.entries
  }
}