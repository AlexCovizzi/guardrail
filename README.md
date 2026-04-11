# guardrail

A static analysis tool designed to enforce hard limits on LLM-generated code. Run it as a post-generation hook or CI gate to catch the patterns LLMs consistently produce: oversized functions, excessive complexity, too many parameters, bloated classes.

## Usage

```bash
guardrail check src/**/*.ts
```

Glob patterns are expanded by guardrail — no shell dependency. Use `--format json` for machine-readable output.

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
| `severity` | `'error'` \| `'warning'` | Violation severity. Errors cause a non-zero exit code; warnings are reported but don't fail the run |
| `enabled` | boolean | Enable or disable a rule |
| `disabled` | boolean | Alias for `enabled: false` |

### Language overrides

The top-level `overrides` key accepts a language name and a `rules` block that is merged over the base `rules`. Supported languages: `javascript`, `jsx`, `typescript`, `tsx`, `python`, `java`, `kotlin`.

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

Warnings are always printed but do not cause a non-zero exit code.

## Claude Code integration

Guardrail can run automatically after every file edit/write in Claude Code via hooks.

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

When a violation is detected, Claude Code will see the error and be blocked from proceeding. Passing files produce no output.

## Custom rules

Place `.ts` or `.js` files in `.guardrail/rules/` at the project root. Each file should export a default function that receives a `Registry`:

```ts
import type { Registry, RuleConfig, SyntaxNode, FileContext, ReportFn } from 'guardrail'

export default function (registry: Registry) {
  registry.register('my-rule', {
    description: 'Description of the rule',
    defaultSeverity: 'warning',
    create(config: RuleConfig) {
      const max = config.number('max', { default: 5 })
      return {
        function(node: SyntaxNode, ctx: FileContext, report: ReportFn) {
          // inspect node, call report() to flag a violation
        },
      }
    },
  })
}
```

### Selectors

Visitor keys are semantic selectors that resolve to language-specific AST node types:

| Selector | Matches |
|---|---|
| `function` | Function declarations, expressions, arrow functions, methods |
| `class` | Class declarations |
| `import` | Import statements |
| `branch` | If, for, while, switch, catch, ternary |
| `parameters` | Parameter lists |

Append `Exit` (e.g., `functionExit`) to visit on node exit instead of entry. Prefix with `_` (e.g., `_my_node_type`) to match raw tree-sitter node types in snake_case.

## Project structure

```
src/
├── cli/
│   └── index.ts                    # Entry point — parses arguments, expands globs, runs the engine
├── config/
│   ├── config.ts                   # Loads config via cosmiconfig; merges global, local, and language overrides
│   └── rule-config.ts              # Per-rule config accessor with typed option parsing
├── core/
│   ├── engine.ts                   # Walks the AST, dispatches to rule visitors, collects violations
│   ├── languages.ts                # Language definitions mapping semantic types to tree-sitter node types
│   └── parser.ts                   # Initialises web-tree-sitter, detects language from filename
└── rules/
    ├── registry.ts                 # Rule registry — deduplicates rule IDs
    ├── loader.ts                   # Loads builtin + discovered rules, applies config
    ├── discovery.ts                # Discovers custom rules from .guardrail/rules/ and global config dir
    ├── rule.ts                     # Shared types: Rule, RuleDefinition, SyntaxNode, FileContext
    └── builtin/
        ├── index.ts                # Registers all builtin rules
        ├── function-length.ts      # function-max-lines
        ├── function-complexity.ts  # function-max-complexity
        ├── function-parameter-count.ts  # function-max-params
        ├── class-length.ts         # class-max-lines
        └── class-max-methods.ts    # class-max-methods
```
