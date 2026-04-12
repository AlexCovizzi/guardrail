# guardrail

[![npm version](https://img.shields.io/npm/v/guardrail.svg)](https://www.npmjs.com/package/guardrail)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A static analysis tool that catches the patterns LLMs consistently produce: oversized functions, excessive complexity, too many parameters, bloated classes. Run it as a post-generation hook or CI gate to keep AI-written code honest.

## Install

```bash
npm install --save-dev guardrail
```

Or run directly:

```bash
npx guardrail check src/**/*.ts
```

## Usage

```bash
guardrail check src/**/*.ts
```

Glob patterns are expanded by guardrail — no shell dependency.

### CLI flags

| Flag | Description |
|---|---|
| `--json` | Machine-readable JSON output |
| `--quiet` | Only show files with violations |
| `--claude-code` | Run as a Claude Code hook (exit 2 on violations, suppress passing-file output) |

## Supported languages

JavaScript, TypeScript, JSX, TSX, Python, Java, Kotlin

## Configuration

Create a `.guardrail.yaml` (or `.guardrail.yml`, `.guardrail.json`, `.guardrail.js`, `.guardrail.ts`) at the project root via [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig):

```yaml
rules:
  function-max-lines:
    max: 40
  function-max-complexity:
    max: 5
  function-max-params:
    max: 4

overrides:
  python:
    rules:
      function-max-lines:
        max: 60
  java:
    rules:
      function-max-complexity:
        disabled: true
```

### Rule options

| Option | Type | Description |
|---|---|---|
| `max` | number | Upper threshold for the rule |
| `severity` | `'error'` \| `'warning'` | Errors cause a non-zero exit code; warnings are reported but don't fail the run |
| `enabled` | boolean | Enable or disable a rule |
| `disabled` | boolean | Alias for `enabled: false` |

### Language overrides

The `overrides` key accepts a language name and a `rules` block that is merged over the base rules. Supported language names: `javascript`, `jsx`, `typescript`, `tsx`, `python`, `java`, `kotlin`.

## Built-in rules

| Rule ID | Description | Default `max` |
|---|---|---|
| `function-max-lines` | Function body must not exceed N lines | 60 |
| `function-max-complexity` | Cyclomatic complexity must not exceed N | 10 |
| `function-max-params` | Function parameter count must not exceed N | 4 |
| `class-max-lines` | Class body must not exceed N lines | 500 |
| `class-max-methods` | Class method count must not exceed N | 20 |

Cyclomatic complexity starts at 1 and increments for each branch point: `if`, `else if`, loops, `switch` cases, `catch` blocks, ternary expressions.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | No errors (warnings may be present) |
| 1 | At least one error-level violation |
| 2 | Claude Code hook mode: error-level violation detected |

## Claude Code integration

Guardrail runs automatically after every file edit/write in Claude Code via hooks.

1. Build and link the binary:

```bash
npm run build && npm link
```

2. Add the hook to `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "guardrail check --claude-code",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

When a violation is detected, Claude Code sees the error and is blocked from proceeding.

## Custom rules

Guardrail supports custom rules in TypeScript or JavaScript. See [CUSTOM_RULES.md](CUSTOM_RULES.md) for the full guide.

Scaffold a new rule:

```bash
# Local rule (project-specific)
guardrail rule add no-console

# Global rule (applies to all projects)
guardrail rule add no-console --scope global
```

List all available rules (builtin + custom):

```bash
guardrail rule list
```

This creates a `.ts` file in `.guardrail/rules/` (local) or `~/.config/guardrail/rules/` (global) with the boilerplate filled in.

## License

MIT
