import type { TimingMetrics } from './timer.js'

function markNamed(metrics: TimingMetrics, name: string): number {
  return metrics.marks.find((mark) => mark.name === name)?.durationMs ?? 0
}

function sumMarksNamed(metrics: TimingMetrics, names: string[]): number {
  return metrics.marks.filter((mark) => names.includes(mark.name)).reduce((sum, mark) => sum + mark.durationMs, 0)
}

function sumMarksByName(metrics: TimingMetrics, name: string): number {
  return metrics.marks.filter((mark) => mark.name === name).reduce((sum, mark) => sum + mark.durationMs, 0)
}

const STARTUP_MARK_NAMES = ['config.load', 'parser.load', 'registry.load']

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

  ruleAverages.sort((left, right) => right.totalMs - left.totalMs)
  return { ruleAverages, totalRuleExec }
}

/** Gather sub-marks that logically belong to the startup phase, in first-seen order. */
function startupPhases(metrics: TimingMetrics): Array<{ name: string; durationMs: number }> {
  const result: Array<{ name: string; durationMs: number }> = []
  for (const mark of metrics.marks) {
    if (STARTUP_MARK_NAMES.includes(mark.name)) {
      result.push({ name: mark.name, durationMs: mark.durationMs })
    }
  }
  return result
}

interface CheckBreakdown {
  phases: Array<{ name: string; durationMs: number; pct: number }>
}

function buildCheckBreakdown(metrics: TimingMetrics): CheckBreakdown {
  const parse = sumMarksByName(metrics, 'parse')
  const createRules = sumMarksByName(metrics, 'createRules')
  const buildDispatch = sumMarksByName(metrics, 'buildDispatch')
  const walk = sumMarksByName(metrics, 'walk')
  const { ruleAverages, totalRuleExec } = aggregateRules(metrics.ruleTotals)

  const walkOverhead = Math.max(walk - totalRuleExec, 0)

  const entries = [
    { name: 'parse', durationMs: parse },
    { name: 'rule execution', durationMs: totalRuleExec },
    { name: 'walk overhead', durationMs: walkOverhead },
    { name: 'create rules', durationMs: createRules },
    { name: 'build dispatch', durationMs: buildDispatch },
  ]

  const phasesTotal = entries.reduce((sum, item) => sum + item.durationMs, 0)

  const phases = entries.map((item) => ({
    ...item,
    pct: phasesTotal > 0 ? (item.durationMs / phasesTotal) * 100 : 0,
  }))

  return { phases }
}

const MS_THRESHOLD = 0.01
const SEPARATOR_WIDTH = 50
const LABEL_WIDTH = 22
const PCT_WIDTH = 4

function formatMsmilliseconds(ms: number): string {
  if (ms < MS_THRESHOLD) return '<0.01 ms'
  return `${ms.toFixed(2)} ms`
}

export interface TimingReport {
  startup: number
  check: number
  total: number
  startupPhases: Array<{ name: string; durationMs: number }>
  checkPhases: Array<{ name: string; durationMs: number; pct: number }>
  filesChecked: number
  totalLines: number
  totalChars: number
  totalNodes: number
  avgPerFile: number
  avgPerLine: number
  avgPerChar: number
  ruleAverages: Array<{ ruleId: string; avgMs: number; totalMs: number; files: number }>
}

export function buildReport(metrics: TimingMetrics): TimingReport {
  const startup = markNamed(metrics, 'startup') || sumMarksNamed(metrics, STARTUP_MARK_NAMES)
  const check = sumMarksNamed(metrics, ['file.expand', 'check.files'])

  // Total is the sum of the two top-level, non-overlapping phases — not the
  // sum of all marks, which would double-count nested timings.
  const total = startup + check

  const checkMs = sumMarksByName(metrics, 'check.files')
  const fileCount = metrics.filesChecked || 1
  const { phases: checkPhases } = buildCheckBreakdown(metrics)
  const { ruleAverages } = aggregateRules(metrics.ruleTotals)

  return {
    startup,
    check,
    total,
    startupPhases: startupPhases(metrics),
    checkPhases,
    filesChecked: metrics.filesChecked,
    totalLines: metrics.totalLines,
    totalChars: metrics.totalChars,
    totalNodes: metrics.totalNodes,
    avgPerFile: checkMs / fileCount,
    avgPerLine: checkMs / (metrics.totalLines || 1),
    avgPerChar: checkMs / (metrics.totalChars || 1),
    ruleAverages,
  }
}

export function formatReport(report: TimingReport): string {
  const lines: string[] = []

  lines.push('guardrail timing report')
  lines.push('─'.repeat(SEPARATOR_WIDTH))

  // Startup phase
  lines.push(`${'startup'.padEnd(LABEL_WIDTH)} ${formatMsmilliseconds(report.startup)}`)
  for (const phase of report.startupPhases) {
    lines.push(`  ${phase.name.padEnd(LABEL_WIDTH - 2)} ${formatMsmilliseconds(phase.durationMs)}`)
  }

  // Check phase
  lines.push(`${'check'.padEnd(LABEL_WIDTH)} ${formatMsmilliseconds(report.check)}`)
  for (const phase of report.checkPhases) {
    const pct = `${phase.pct.toFixed(0)}%`
    lines.push(
      `  ${phase.name.padEnd(LABEL_WIDTH - 2)} ${formatMsmilliseconds(phase.durationMs)}  ${pct.padStart(PCT_WIDTH)}`
    )
  }

  lines.push('─'.repeat(SEPARATOR_WIDTH))
  lines.push(`${'total'.padEnd(LABEL_WIDTH)} ${formatMsmilliseconds(report.total)}`)

  if (report.filesChecked > 0) {
    lines.push('')
    lines.push(`checked ${report.filesChecked} files (${report.totalLines} lines, ${report.totalNodes} nodes)`)
    lines.push(`  avg per file:    ${formatMsmilliseconds(report.avgPerFile)}`)
    lines.push(`  avg per line:   ${formatMsmilliseconds(report.avgPerLine)}`)
    lines.push(`  avg per char:   ${formatMsmilliseconds(report.avgPerChar)}`)
  }

  if (report.ruleAverages.length > 0) {
    const MIN_RULE_COL = 10
    const NUM_COL_WIDTH = 10
    const FILES_COL_WIDTH = 6

    lines.push('')
    lines.push('per-rule averages:')
    const maxRuleLen = Math.max(...report.ruleAverages.map((rule) => rule.ruleId.length), MIN_RULE_COL)
    lines.push(
      `${'rule'.padEnd(maxRuleLen + 2)} ${'avg/file'.padStart(NUM_COL_WIDTH)} ${'total'.padStart(NUM_COL_WIDTH)} ${'files'.padStart(FILES_COL_WIDTH)}`
    )
    lines.push('─'.repeat(maxRuleLen + 2 + NUM_COL_WIDTH + NUM_COL_WIDTH + FILES_COL_WIDTH))
    for (const rule of report.ruleAverages) {
      lines.push(
        `${rule.ruleId.padEnd(maxRuleLen + 2)} ${formatMsmilliseconds(rule.avgMs).padStart(NUM_COL_WIDTH)} ${formatMsmilliseconds(rule.totalMs).padStart(NUM_COL_WIDTH)} ${String(rule.files).padStart(FILES_COL_WIDTH)}`
      )
    }
  }

  return lines.join('\n')
}
