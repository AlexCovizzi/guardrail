import type { TimingMetrics } from './timer.js'

export interface TimingReport {
  marks: Array<{ name: string; durationMs: number }>
  startup: number
  check: number
  total: number
  filesChecked: number
  totalLines: number
  totalChars: number
  totalNodes: number
  avgPerFile: number
  avgPerLine: number
  avgPerChar: number
  breakdown: {
    parse: number
    createRules: number
    buildDispatch: number
    walkOverhead: number
    ruleExec: number
  }
  ruleAverages: Array<{ ruleId: string; avgMs: number; totalMs: number; files: number }>
}

function markNamed(metrics: TimingMetrics, name: string): number {
  return metrics.marks.find((m) => m.name === name)?.durationMs ?? 0
}

function sumMarksNamed(metrics: TimingMetrics, names: string[]): number {
  return metrics.marks.filter((m) => names.includes(m.name)).reduce((sum, m) => sum + m.durationMs, 0)
}

function sumMarksByName(metrics: TimingMetrics, name: string): number {
  return metrics.marks.filter((m) => m.name === name).reduce((sum, m) => sum + m.durationMs, 0)
}

function aggregateRules(ruleTotals: TimingMetrics['ruleTotals']): {
  ruleAverages: TimingReport['ruleAverages']
  totalRuleExec: number
} {
  let totalRuleExec = 0
  const ruleAverages: TimingReport['ruleAverages'] = []

  for (const [ruleId, { totalMs, files }] of ruleTotals) {
    totalRuleExec += totalMs
    ruleAverages.push({ ruleId, avgMs: totalMs / files, totalMs, files })
  }

  ruleAverages.sort((a, b) => b.totalMs - a.totalMs)
  return { ruleAverages, totalRuleExec }
}

export function buildReport(metrics: TimingMetrics): TimingReport {
  const startup =
    markNamed(metrics, 'startup') || sumMarksNamed(metrics, ['config.load', 'parser.load', 'registry.load'])
  const check = sumMarksNamed(metrics, ['file.expand', 'check.files'])
  const total = metrics.marks.reduce((s, m) => s + m.durationMs, 0)

  const checkFilesMs = markNamed(metrics, 'check.files')
  const totalLines = metrics.totalLines
  const totalChars = metrics.totalChars
  const totalNodes = metrics.totalNodes
  const fileCount = metrics.filesChecked || 1

  // Direct aggregate timings from timer.measure — no concurrency inflation
  const parse = sumMarksByName(metrics, 'parse')
  const createRules = sumMarksByName(metrics, 'createRules')
  const buildDispatch = sumMarksByName(metrics, 'buildDispatch')
  const walk = sumMarksByName(metrics, 'walk')

  const { ruleAverages, totalRuleExec } = aggregateRules(metrics.ruleTotals)
  const walkOverhead = Math.max(walk - totalRuleExec, 0)

  return {
    marks: metrics.marks,
    startup,
    check,
    total,
    filesChecked: metrics.filesChecked,
    totalLines,
    totalChars,
    totalNodes,
    avgPerFile: checkFilesMs / fileCount,
    avgPerLine: checkFilesMs / (totalLines || 1),
    avgPerChar: checkFilesMs / (totalChars || 1),
    breakdown: { parse, createRules, buildDispatch, walkOverhead, ruleExec: totalRuleExec },
    ruleAverages,
  }
}

function formatBreakdown(lines: string[], report: TimingReport): void {
  const bd = report.breakdown
  const total = bd.parse + bd.createRules + bd.buildDispatch + bd.walkOverhead + bd.ruleExec
  if (total <= 0) return

  const pct = (v: number) => `${((v / total) * 100).toFixed(0)}%`
  const w = 18

  lines.push('')
  lines.push('check breakdown:')
  lines.push(`${'  parse'.padEnd(w)} ${formatMs(bd.parse).padStart(10)}  ${pct(bd.parse)}`)
  lines.push(`${'  walk overhead'.padEnd(w)} ${formatMs(bd.walkOverhead).padStart(10)}  ${pct(bd.walkOverhead)}`)
  lines.push(`${'  rule execution'.padEnd(w)} ${formatMs(bd.ruleExec).padStart(10)}  ${pct(bd.ruleExec)}`)
  lines.push(`${'  create rules'.padEnd(w)} ${formatMs(bd.createRules).padStart(10)}  ${pct(bd.createRules)}`)
  lines.push(`${'  build dispatch'.padEnd(w)} ${formatMs(bd.buildDispatch).padStart(10)}  ${pct(bd.buildDispatch)}`)
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

  if (report.filesChecked > 0) {
    lines.push('')
    lines.push(`checked ${report.filesChecked} files (${report.totalLines} lines, ${report.totalNodes} nodes)`)
    lines.push(`  avg per file:    ${formatMs(report.avgPerFile)}`)
    lines.push(`  avg per line:   ${formatMs(report.avgPerLine)}`)
    lines.push(`  avg per char:   ${formatMs(report.avgPerChar)}`)
  }

  formatBreakdown(lines, report)

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
