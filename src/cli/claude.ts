import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createCommand } from 'commander'
import { RULES_TEMPLATE } from './claude-rules-template.js'
import { ConfigLoadError } from '../config/config.js'
import { globalPaths } from '../config/paths.js'
import { Guardrail } from '../core/guardrail.js'

export const GUARDRAIL_HOOK_COMMAND = 'guardrail claude check'
export const CLAUDE_MD_LINE = 'Guardrail enforces code-quality bounds on every file edit. To add or modify rules, see ~/.guardrail/RULES.md'

interface HookEntry {
  matcher: string
  hooks: { type: string; command: string; timeout?: number }[]
}

interface InitPaths {
  settingsJson: string
  claudeMd: string
  rulesMd: string
  settingsDir: string
  claudeMdDir: string
  rulesDir: string
}

export function getPaths(scope: string, cwd: string, home: string): InitPaths {
  const gp = globalPaths(home)
  if (scope === 'global') {
    return {
      settingsJson: join(home, '.claude', 'settings.json'),
      settingsDir: join(home, '.claude'),
      claudeMd: join(home, '.claude', 'CLAUDE.md'),
      claudeMdDir: join(home, '.claude'),
      rulesMd: join(gp.configDir, 'RULES.md'),
      rulesDir: gp.configDir,
    }
  }
  return {
    settingsJson: join(cwd, '.claude', 'settings.json'),
    settingsDir: join(cwd, '.claude'),
    claudeMd: join(cwd, 'CLAUDE.md'),
    claudeMdDir: cwd,
    rulesMd: join(gp.configDir, 'RULES.md'),
    rulesDir: gp.configDir,
  }
}

export function mergeHookIntoSettings(existing: Record<string, unknown>): { settings: Record<string, unknown>; added: boolean } {
  const desired: HookEntry = {
    matcher: 'Edit|Write',
    hooks: [{ type: 'command', command: GUARDRAIL_HOOK_COMMAND, timeout: 30 }],
  }
  const hooks = (existing.hooks ?? {}) as Record<string, HookEntry[]>
  const postHooks: HookEntry[] = hooks.PostToolUse || []

  if (postHooks.some((h) => h.hooks.some((hook) => hook.command === desired.hooks[0].command))) {
    return { settings: existing, added: false }
  }

  return {
    settings: { ...existing, hooks: { ...hooks, PostToolUse: [...postHooks, desired] } },
    added: true,
  }
}

export function mergePromptIntoClaudeMd(content: string, line: string): { content: string; added: boolean } {
  if (content.includes(line)) {
    return { content, added: false }
  }
  const trimmed = content.trimEnd()
  return { content: trimmed ? `${trimmed}\n\n${line}\n` : `${line}\n`, added: true }
}

// --- CLI ---

export function claudeCommand() {
  return createCommand('claude')
    .description('Claude Code integration')
    .addCommand(
      createCommand('init')
        .description('Set up Claude Code hooks and prompt')
        .option('--scope <scope>', 'Where to set up: local or global', 'global')
        .action(initClaude)
    )
    .addCommand(
      createCommand('check')
        .description('Run as a Claude Code hook (reads stdin JSON)')
        .action(checkClaude)
    )
}

// --- init ---

async function initClaude(options: { scope: string }): Promise<void> {
  const scope = options.scope
  if (scope !== 'local' && scope !== 'global') {
    process.stderr.write(`guardrail: invalid scope "${scope}". Use "local" or "global".\n`)
    process.exit(1)
  }

  const cwd = process.cwd()
  const home = process.env.HOME || process.env.USERPROFILE || ''
  const paths = getPaths(scope, cwd, home)

  const plan = computeInitPlan(paths)
  printPlan(plan, paths)

  process.stdout.write('Proceed? [y/N] ')
  const answer = await readLine()
  if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
    console.log('Aborted.')
    process.exit(0)
  }

  executePlan(plan, paths)
  console.log('\nDone! Guardrail will now run automatically after every file edit in Claude Code.')
}

interface InitAction {
  kind: 'hook' | 'prompt' | 'rules'
  data: string
}

function computeInitPlan(paths: InitPaths): InitAction[] {
  const actions: InitAction[] = []

  // Hook
  const settingsExists = existsSync(paths.settingsJson)
  const currentSettings = settingsExists
    ? JSON.parse(readFileSync(paths.settingsJson, 'utf-8'))
    : {}
  const { settings: newSettings, added: hookAdded } = mergeHookIntoSettings(currentSettings)
  if (hookAdded) {
    actions.push({ kind: 'hook', data: JSON.stringify(newSettings, null, 2) + '\n' })
  }

  // Prompt
  const claudeMdExists = existsSync(paths.claudeMd)
  const currentClaudeMd = claudeMdExists ? readFileSync(paths.claudeMd, 'utf-8') : ''
  const { content: newClaudeMd, added: promptAdded } = mergePromptIntoClaudeMd(currentClaudeMd, CLAUDE_MD_LINE)
  if (promptAdded) {
    actions.push({ kind: 'prompt', data: newClaudeMd })
  }

  // Rules
  if (!existsSync(paths.rulesMd)) {
    actions.push({ kind: 'rules', data: RULES_TEMPLATE })
  }

  return actions
}

function printPlan(actions: InitAction[], paths: InitPaths): void {
  console.log('The following changes will be made:\n')
  if (!actions.some((a) => a.kind === 'hook')) {
    console.log(`  ${paths.settingsJson} — hook already exists, skipping`)
  } else {
    console.log(`  ${paths.settingsJson} — add PostToolUse hook (Edit|Write → ${GUARDRAIL_HOOK_COMMAND})`)
  }
  if (!actions.some((a) => a.kind === 'prompt')) {
    console.log(`  ${paths.claudeMd} — prompt line already exists, skipping`)
  } else {
    console.log(`  ${paths.claudeMd} — append guardrail prompt line`)
  }
  if (!actions.some((a) => a.kind === 'rules')) {
    console.log(`  ${paths.rulesMd} — already exists, skipping`)
  } else {
    console.log(`  ${paths.rulesMd} — write custom rule instructions`)
  }
  console.log()
}

function executePlan(actions: InitAction[], paths: InitPaths): void {
  for (const action of actions) {
    switch (action.kind) {
      case 'hook':
        mkdirSync(paths.settingsDir, { recursive: true })
        writeFileSync(paths.settingsJson, action.data)
        console.log(`  ✓ ${paths.settingsJson}`)
        break
      case 'prompt':
        mkdirSync(paths.claudeMdDir, { recursive: true })
        writeFileSync(paths.claudeMd, action.data)
        console.log(`  ✓ ${paths.claudeMd}`)
        break
      case 'rules':
        mkdirSync(paths.rulesDir, { recursive: true })
        writeFileSync(paths.rulesMd, action.data)
        console.log(`  ✓ ${paths.rulesMd}`)
        break
    }
  }
}

// --- check ---

async function checkClaude(): Promise<void> {
  let gr: Guardrail
  try {
    gr = await Guardrail.load()
  } catch (err) {
    if (err instanceof ConfigLoadError) {
      process.stderr.write(`guardrail: ${err.message}\n`)
      process.exit(2)
    }
    throw err
  }

  const input = await readStdin()
  let filePath: string | undefined
  try {
    filePath = JSON.parse(input)?.tool_input?.file_path
  } catch {
    process.exit(0)
  }
  if (!filePath) process.exit(0)

  const result = await gr.check([filePath])
  if (!result.every((r) => r.passed)) {
    process.stderr.write(`${JSON.stringify(result)}\n`)
    process.exit(2)
  }
  process.exit(0)
}

// --- helpers ---

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf-8')
    process.stdin.on('data', (chunk: string) => (data += chunk))
    process.stdin.on('end', () => resolve(data))
    if (process.stdin.isTTY) resolve('')
  })
}

function readLine(): Promise<string> {
  return new Promise((resolve) => {
    process.stdin.resume()
    process.stdin.once('data', (data) => {
      process.stdin.pause()
      resolve(data.toString().trim())
    })
  })
}
