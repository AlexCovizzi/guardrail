import {RuleDefinition} from "./rule.js";

type RuleEntry = {
  ruleId: string
  definition: RuleDefinition
}

export class RuleRegistry {
  private entries: RuleEntry[] = []

  register(ruleId: string, definition: RuleDefinition): void {
    if (this.entries.some((e) => e.ruleId === ruleId)) {
      throw new Error(`Duplicate rule registration: "${ruleId}"`)
    }
    this.entries.push({ruleId, definition})
  }

  getEntries(): RuleEntry[] {
    return [...this.entries]
  }
}
