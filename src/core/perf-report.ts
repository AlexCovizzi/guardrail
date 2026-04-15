import type { TimingMetrics } from './timer.js'

export interface TimingReport {
  marks: Array<{ name: string; durationMs: number }>
  startup: number
  check: number
  total: number
  filesChecked: number
  totalLines: number
  totalChars: number
  avgPerFile: number
  avgPerLine: number
  avgPerChar: number
  totalFiles: number
  changedFiles: number
  cacheHitRate: number
  ruleAverages: Array<{ ruleId: string; avgMs: number; totalMs: number; files: number }>
}

function markNamed(metrics: TimingMetrics, name: string): number {
  return metrics.marks.find((m) => m.name === name)?.durationMs ?? 0
}

function sumMarksNamed(metrics: TimingMetrics, names: string[]): number {
  return metrics.marks.filter((m) => names.includes(m.name)).reduce((sum, m) => sum + m.durationMs, 0)
}

export function buildReport(metrics: TimingMetrics): TimingReport {
  const startup = sumMarksNamed(metrics, ['config.load', 'parser.load', 'cache.load', 'registry.load'])
  const check = sumMarksNamed(metrics, ['file.expand', 'cache.diff', 'parse.changed', 'cache.write', 'check.files'])
  const total = metrics.marks.reduce((s, m) => s + m.durationMs, 0)

  const checkFilesMs = markNamed(metrics, 'check.files')
  const totalLines = metrics.perFile.reduce((s, f) => s + f.lines, 0)
  const totalChars = metrics.perFile.reduce((s, f) => s + f.chars, 0)
  const fileCount = metrics.perFile.length || 1

  const ruleTotals = new Map<string, { totalMs: number; files: number }>()
  for (const f of metrics.perFile) {
    for (const [ruleId, ms] of f.perRule) {
      const entry = ruleTotals.get(ruleId)
      if (entry) {
        entry.totalMs += ms
        entry.files += 1
      } else {
        ruleTotals.set(ruleId, { totalMs: ms, files: 1 })
      }
    }
  }

  const ruleAverages = [...ruleTotals.entries()]
    .map(([ruleId, { totalMs, files }]) => ({
      ruleId,
      avgMs: totalMs / files,
      totalMs,
      files,
    }))
    .sort((a, b) => b.totalMs - a.totalMs)

  return {
    marks: metrics.marks,
    startup,
    check,
    total,
    filesChecked: metrics.perFile.length,
    totalLines,
    totalChars,
    avgPerFile: checkFilesMs / fileCount,
    avgPerLine: checkFilesMs / (totalLines || 1),
    avgPerChar: checkFilesMs / (totalChars || 1),
    totalFiles: metrics.totalFiles,
    changedFiles: metrics.changedFiles,
    cacheHitRate: metrics.cacheHitRate,
    ruleAverages,
  }
}

export function formatReport(report: TimingReport): string {
  const lines: string[] = []

  lines.push('guardrail timing report')
  lines.push('─'.repeat(50))

  const maxNameLen = Math.max(...report.marks.map((m) => m.name.length), 20)
  for (const m of report.marks) {
    lines.push(`${m.name.padEnd(maxNameLen + 2)} ${m.durationMs.toFixed(1)} ms`)
  }

  lines.push('─'.repeat(50))
  lines.push(`${'startup'.padEnd(maxNameLen + 2)} ${report.startup.toFixed(1)} ms`)
  lines.push(`${'check'.padEnd(maxNameLen + 2)} ${report.check.toFixed(1)} ms`)
  lines.push(`${'total'.padEnd(maxNameLen + 2)} ${report.total.toFixed(1)} ms`)

  lines.push('')
  lines.push(
    `cache: ${report.changedFiles}/${report.totalFiles} files changed (${(report.cacheHitRate * 100).toFixed(0)}% hit rate)`
  )

  if (report.filesChecked > 0) {
    lines.push('')
    lines.push(`checked ${report.filesChecked} files (${report.totalLines} lines, ${report.totalChars} chars)`)
    lines.push(`  avg per file:    ${formatMs(report.avgPerFile)}`)
    lines.push(`  avg per line:   ${formatMs(report.avgPerLine)}`)
    lines.push(`  avg per char:   ${formatMs(report.avgPerChar)}`)
  }

  if (report.ruleAverages.length > 0) {
    lines.push('')
    lines.push('per-rule averages:')
    const maxRuleLen = Math.max(...report.ruleAverages.map((r) => r.ruleId.length), 10)
    lines.push(
      `${'rule'.padEnd(maxRuleLen + 2)} ${'avg/file'.padStart(10)} ${'total'.padStart(10)} ${'files'.padStart(6)}`
    )
    lines.push('─'.repeat(maxRuleLen + 2 + 10 + 10 + 6))
    for (const r of report.ruleAverages) {
      lines.push(
        `${r.ruleId.padEnd(maxRuleLen + 2)} ${formatMs(r.avgMs).padStart(10)} ${formatMs(r.totalMs).padStart(10)} ${String(r.files).padStart(6)}`
      )
    }
  }

  return lines.join('\n')
}

function formatMs(ms: number): string {
  if (ms < 0.01) return '<0.01 ms'
  return `${ms.toFixed(2)} ms`
}
