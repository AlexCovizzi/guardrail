export interface TimingMark {
  name: string
  durationMs: number
}

export interface TimingMetrics {
  marks: TimingMark[]
  filesChecked: number
  totalLines: number
  totalChars: number
  totalNodes: number
  ruleTotals: Map<string, { totalMs: number; files: number }>
}

export class Timer {
  private marks: TimingMark[] = []
  private markStarts = new Map<string, number>()
  private metrics: TimingMetrics = {
    marks: this.marks,
    filesChecked: 0,
    totalLines: 0,
    totalChars: 0,
    totalNodes: 0,
    ruleTotals: new Map(),
  }

  start(name: string): void {
    this.markStarts.set(name, performance.now())
  }

  end(name: string): void {
    const now = performance.now()
    const start = this.markStarts.get(name)
    if (start !== undefined) {
      this.marks.push({ name, durationMs: now - start })
      this.markStarts.delete(name)
    }
  }

  measure<T>(name: string, fn: () => T): T
  measure<T>(name: string, fn: () => Promise<T>): Promise<T>
  measure<T>(name: string, fn: () => T | Promise<T>): T | Promise<T> {
    this.start(name)
    try {
      const result = fn()
      if (result instanceof Promise) {
        return result.then(
          (v) => {
            this.end(name)
            return v
          },
          (e) => {
            this.end(name)
            throw e
          }
        )
      }
      this.end(name)
      return result
    } catch (e) {
      this.end(name)
      throw e
    }
  }

  addFileStats(lines: number, chars: number, nodes: number): void {
    this.metrics.filesChecked++
    this.metrics.totalLines += lines
    this.metrics.totalChars += chars
    this.metrics.totalNodes += nodes
  }

  addRuleTime(ruleId: string, ms: number): void {
    const existing = this.metrics.ruleTotals.get(ruleId)
    if (existing) {
      existing.totalMs += ms
      existing.files += 1
    } else {
      this.metrics.ruleTotals.set(ruleId, { totalMs: ms, files: 1 })
    }
  }

  getMetrics(): TimingMetrics {
    return this.metrics
  }
}