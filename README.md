# guardrail

A static analysis tool designed to enforce hard limits on LLM-generated code. Run it as a post-generation hook or CI gate to catch the patterns LLMs consistently produce: oversized functions, excessive complexity, debug leftovers, noise comments.

## Usage

```bash
guardrail check src/**/*.ts
```

## Configuration

Create a `.guardrail` file at the project root (YAML, JSON, or JS — via [cosmiconfig](https://github.com/cosmiconfig/cosmiconfig)):

```yaml
rules:
  function-max-lines:
    max: 40
  function-max-complexity:
    max: 5

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
| `disabled` | boolean | Disable a rule for a specific language override |

### Language overrides

The top-level `overrides` key accepts a language name and a `rules` block that is merged over the base `rules`. Supported languages: `javascript`, `typescript`, `python`, `java`, `kotlin`.

## Built-in rules

| Rule ID | Description | Default `max` |
|---|---|---|
| `function-max-lines` | Function body must not exceed N lines | 10 |
| `function-max-complexity` | Cyclomatic complexity of a function must not exceed N | 10 |

Cyclomatic complexity starts at 1 and increments for each branch point: `if`, `else if`, loops, `switch` cases, `catch` blocks, ternary expressions.

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

## Project structure

```
src/
├── cli/
│   └── index.ts          # Entry point — parses arguments, runs the engine
├── config/
│   └── resolver.ts       # Loads .guardrail via cosmiconfig; merges language overrides
├── core/
│   ├── engine.ts         # Walks the AST, applies rules, returns violations
│   ├── parser.ts         # Initialises web-tree-sitter, detects language from filename
│   └── types.ts          # Shared interfaces: Rule, Config, Context, Violation, Result
└── rules/
    ├── loader.ts         # Instantiates rules from config
    └── builtin/
        ├── function-length.ts      # function-max-lines rule
        └── function-complexity.ts  # function-max-complexity rule
```

## Adding a rule

1. Create `src/rules/builtin/<rule-name>.ts` and export a factory function that returns a `Rule`.
2. Register it in `src/rules/loader.ts` — read the config key, instantiate the rule if not disabled.

A `Rule` has three required fields and two optional:

```ts
interface Rule {
  id: string;
  name: string;          // used as the violation message
  description: string;
  severity: 'error' | 'warning';
  languages?: string[];  // if omitted, rule applies to all languages
  match(node: any, context: Context): boolean;  // return true to flag a violation
  fix?(node: any, context: Context): string | undefined;
}
```

`match` is called for every AST node in the file. The `context` carries `language`, `filename`, `source`, and the full `tree`. Use `languages` to restrict a rule to specific languages rather than checking `context.language` inside `match`.