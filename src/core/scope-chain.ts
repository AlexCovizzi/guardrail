import type { Handler, Rule } from '../rules/rule.js'
import type { NodePattern } from './languages/types.js'

export interface ScopeMapEntry {
  handler: Handler
  pattern?: NodePattern
}

export interface ScopeFrame {
  rule: Rule
  entryMap: Map<string, ScopeMapEntry[]>
  exitMap: Map<string, ScopeMapEntry[]>
  exitHandler?: Handler
  openerNodeId: number
}

/**
 * Ordered chain of active rule scopes, walked closest-to-outermost during dispatch.
 * Also tracks the union of node types any active scope cares about, so nodes whose
 * type nobody handles can skip dispatch entirely.
 */
export class ScopeChain {
  private readonly frames: ScopeFrame[] = []
  // Monotonic: types get added when scopes enter, but never removed when they close.
  // Shrinking would require recomputing the union; the false-positive cost on the
  // fast path (one extra dispatch loop that finds no entries) is cheaper.
  private readonly tracked = new Set<string>()

  get size(): number {
    return this.frames.length
  }

  at(index: number): ScopeFrame {
    return this.frames[index]
  }

  tracks(nodeType: string): boolean {
    return this.tracked.has(nodeType)
  }

  enter(frame: ScopeFrame): void {
    this.frames.push(frame)
    for (const type of frame.entryMap.keys()) this.tracked.add(type)
    for (const type of frame.exitMap.keys()) this.tracked.add(type)
  }

  *closeAt(nodeId: number): Generator<ScopeFrame> {
    while (this.frames.length > 0 && this.frames[this.frames.length - 1].openerNodeId === nodeId) {
      yield this.frames.pop()!
    }
  }
}
