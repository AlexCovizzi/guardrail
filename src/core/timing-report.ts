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
  totalFiles: number
  changedFiles: number
  cacheHitRate: number
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

function aggregateRules(perFile: TimingMetrics['perFile']): {
  ruleAverages: TimingReport['ruleAverages']
  totalRuleExec: number
} {
  const ruleTotals = new Map<string, { totalMs: number; files: number }>()
  for (const f of perFile) {
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

  const totalRuleExec = [...ruleTotals.values()].reduce((s, r) => s + r.totalMs, 0)
  const ruleAverages = [...ruleTotals.entries()]
    .map(([ruleId, { totalMs, files }]) => ({
      ruleId,
      avgMs: totalMs / files,
      totalMs,
      files,
    }))
    .sort((a, b) => b.totalMs - a.totalMs)

  return { ruleAverages, totalRuleExec }
}

/**
 * Per-file timing for parse, createRules, and buildDispatch is inflated
 * under concurrent Promise.all execution — each file's timer includes time
 * waiting for other files' synchronous work on the shared JS thread.
 *
 * Walk and rule execution are NOT inflated: walk runs synchronously after
 * each file's await resolves, and rule timing is measured synchronously.
 *
 * So we use walkMs and ruleExec directly, and scale only the concurrency-
 * inflated measurements (parse, createRules, buildDispatch) to fill the
 * remaining wall-clock time.
 */
function estimateBreakdown(
  metrics: TimingMetrics,
  checkFilesMs: number,
  totalRuleExec: number
): TimingReport['breakdown'] {
  const aggParse = metrics.perFile.reduce((s, f) => s + f.parseMs, 0)
  const aggCreateRules = metrics.perFile.reduce((s, f) => s + f.createRulesMs, 0)
  const aggBuildDispatch = metrics.perFile.reduce((s, f) => s + f.buildDispatchMs, 0)
  const aggWalk = metrics.perFile.reduce((s, f) => s + f.walkMs, 0)

  // walk and ruleExec are synchronous — not subject to concurrency inflation
  const walkOverhead = Math.max(aggWalk - totalRuleExec, 0)

  // parse, createRules, buildDispatch ARE inflated by concurrency — scale them
  const wallClockOverhead = Math.max(checkFilesMs - totalRuleExec - walkOverhead, 0)
  const aggInflated = aggParse + aggCreateRules + aggBuildDispatch

  if (aggInflated <= 0) {
    return { parse: 0, createRules: 0, buildDispatch: 0, walkOverhead, ruleExec: totalRuleExec }
  }

  const scale = wallClockOverhead / aggInflated
  return {
    parse: aggParse * scale,
    createRules: aggCreateRules * scale,
    buildDispatch: aggBuildDispatch * scale,
    walkOverhead,
    ruleExec: totalRuleExec,
  }
}

export function buildReport(metrics: TimingMetrics): TimingReport {
  const startup = sumMarksNamed(metrics, ['config.load', 'parser.load', 'cache.load', 'registry.load'])
  const check = sumMarksNamed(metrics, ['file.expand', 'cache.diff', 'parse.changed', 'cache.write', 'check.files'])
  const total = metrics.marks.reduce((s, m) => s + m.durationMs, 0)

  const checkFilesMs = markNamed(metrics, 'check.files')
  const totalLines = metrics.perFile.reduce((s, f) => s + f.lines, 0)
  const totalChars = metrics.perFile.reduce((s, f) => s + f.chars, 0)
  const totalNodes = metrics.perFile.reduce((s, f) => s + f.nodesVisited, 0)
  const fileCount = metrics.perFile.length || 1

  const { ruleAverages, totalRuleExec } = aggregateRules(metrics.perFile)
  const breakdown = estimateBreakdown(metrics, checkFilesMs, totalRuleExec)

  return {
    marks: metrics.marks,
    startup,
    check,
    total,
    filesChecked: metrics.perFile.length,
    totalLines,
    totalChars,
    totalNodes,
    avgPerFile: checkFilesMs / fileCount,
    avgPerLine: checkFilesMs / (totalLines || 1),
    avgPerChar: checkFilesMs / (totalChars || 1),
    totalFiles: metrics.totalFiles,
    changedFiles: metrics.changedFiles,
    cacheHitRate: metrics.cacheHitRate,
    breakdown,
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

  lines.push('')
  lines.push(
    `cache: ${report.changedFiles}/${report.totalFiles} files changed (${(report.cacheHitRate * 100).toFixed(0)}% hit rate)`
  )

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
