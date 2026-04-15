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
  totalFiles: number
  changedFiles: number
  cacheHitRate: number
}

export class Timer {
  private marks: TimingMark[] = []
  private markStarts = new Map<string, number>()
  private metrics: TimingMetrics = {
    marks: this.marks,
    perFile: [],
    totalFiles: 0,
    changedFiles: 0,
    cacheHitRate: 0,
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

  measure<T>(name: string, fn: () => T): T {
    this.start(name)
    try {
      return fn()
    } finally {
      this.end(name)
    }
  }

  async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    this.start(name)
    try {
      return await fn()
    } finally {
      this.end(name)
    }
  }

  getMetrics(): TimingMetrics {
    return this.metrics
  }
}
