import { Registry, RuleDefinition } from '../core/types.js'

type Entry = {
  id: string
  definition: RuleDefinition
}

export class RuleRegistry implements Registry {
  private entries: Entry[] = []

  register(id: string, definition: RuleDefinition): void {
    this.entries.push({ id, definition })
  }

  getEntries(): Entry[] {
    return this.entries
  }
}
