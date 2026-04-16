import { describe, expect, it } from 'vitest'
import { mergeHookIntoSettings, mergePromptIntoClaudeMd, getPaths, CLAUDE_MD_LINE, GUARDRAIL_HOOK_COMMAND } from './claude.js'

describe('getPaths', () => {
  it('returns global paths for scope=global (default)', () => {
    const paths = getPaths('global', '/project', '/home/user')
    expect(paths.settingsJson).toBe('/home/user/.claude/settings.json')
    expect(paths.claudeMd).toBe('/home/user/.claude/CLAUDE.md')
    expect(paths.rulesMd).toBe('/home/user/.guardrail/RULES.md')
  })

  it('returns local paths for scope=local', () => {
    const paths = getPaths('local', '/project', '/home/user')
    expect(paths.settingsJson).toBe('/project/.claude/settings.json')
    expect(paths.claudeMd).toBe('/project/CLAUDE.md')
    expect(paths.rulesMd).toBe('/home/user/.guardrail/RULES.md')
  })
})

describe('mergeHookIntoSettings', () => {
  it('adds hook to empty settings', () => {
    const { settings, added } = mergeHookIntoSettings({})
    expect(added).toBe(true)
    const postHooks = (settings.hooks as Record<string, unknown[]>).PostToolUse
    expect(postHooks).toHaveLength(1)
    expect(postHooks[0]).toMatchObject({
      matcher: 'Edit|Write',
      hooks: [{ type: 'command', command: GUARDRAIL_HOOK_COMMAND }],
    })
  })

  it('adds hook alongside existing hooks', () => {
    const existing = {
      hooks: {
        PostToolUse: [
          {
            matcher: 'Bash',
            hooks: [{ type: 'command', command: 'other-tool' }],
          },
        ],
      },
    }
    const { settings, added } = mergeHookIntoSettings(existing)
    expect(added).toBe(true)
    const postHooks = (settings.hooks as Record<string, unknown[]>).PostToolUse
    expect(postHooks).toHaveLength(2)
  })

  it('skips if hook already exists', () => {
    const existing = {
      hooks: {
        PostToolUse: [
          {
            matcher: 'Edit|Write',
            hooks: [{ type: 'command', command: GUARDRAIL_HOOK_COMMAND, timeout: 30 }],
          },
        ],
      },
    }
    const { settings, added } = mergeHookIntoSettings(existing)
    expect(added).toBe(false)
    expect(settings).toEqual(existing)
  })

  it('preserves other top-level keys', () => {
    const existing = { someKey: 'value', hooks: {} }
    const { settings, added } = mergeHookIntoSettings(existing)
    expect(added).toBe(true)
    expect(settings.someKey).toBe('value')
  })
})

describe('mergePromptIntoClaudeMd', () => {
  it('appends to empty file', () => {
    const { content, added } = mergePromptIntoClaudeMd('', CLAUDE_MD_LINE)
    expect(added).toBe(true)
    expect(content).toBe(`${CLAUDE_MD_LINE}\n`)
  })

  it('appends to existing file', () => {
    const { content, added } = mergePromptIntoClaudeMd('Be concise.\n', CLAUDE_MD_LINE)
    expect(added).toBe(true)
    expect(content).toBe(`Be concise.\n${CLAUDE_MD_LINE}\n`)
  })

  it('skips if line already exists', () => {
    const existing = `${CLAUDE_MD_LINE}\n`
    const { content, added } = mergePromptIntoClaudeMd(existing, CLAUDE_MD_LINE)
    expect(added).toBe(false)
    expect(content).toBe(existing)
  })

  it('handles file without trailing newline', () => {
    const { content, added } = mergePromptIntoClaudeMd('Be concise.', CLAUDE_MD_LINE)
    expect(added).toBe(true)
    expect(content).toBe(`Be concise.\n${CLAUDE_MD_LINE}\n`)
  })
})