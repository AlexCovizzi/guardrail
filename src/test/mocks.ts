import { Timer } from '../core/timer.js'

export class MockTimer extends Timer {
  start(): void {}
  end(): void {}
  measure<T>(name: string, fn: () => T): T
  measure<T>(name: string, fn: () => Promise<T>): Promise<T>
  measure<T>(_name: string, fn: () => T | Promise<T>): T | Promise<T> {
    return fn()
  }
  addFileStats(_lines: number, _chars: number, _nodes: number): void {}
  addRuleTime(_ruleId: string, _ms: number): void {}
}
