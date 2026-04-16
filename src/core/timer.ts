export interface TimingMark {
  name: string
  durationMs: number
}

export interface PerFileTiming {
  filename: string
  lines: number
  chars: number
  nodesVisited: number
  parseMs: number
  createRulesMs: number
  buildDispatchMs: number
  walkMs: number
  totalMs: number
  perRule: Map<string, number>
}

export interface TimingMetrics {
  marks: TimingMark[]
  perFile: PerFileTiming[]
}

export class Timer {
  private marks: TimingMark[] = []
  private markStarts = new Map<string, number>()
  private metrics: TimingMetrics = {
    marks: this.marks,
    perFile: [],
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

  getMetrics(): TimingMetrics {
    return this.metrics
  }
}
