# Writing Custom Rules

Guardrail lets you write your own rules in TypeScript or JavaScript. Place them in `.guardrail/rules/` (project-local) or `~/.config/guardrail/rules/` (global).

## File Format

Each file exports a **register function**. It receives a `register` callback — call it with a rule ID and a `RuleDefinition`.

```ts
import type { RegisterFn } from '@alexcvzz/guardrail'

export default function(register: RegisterFn) {
  register('my-rule-id', {
    description: 'What this rule checks',
    defaultSeverity: 'error', // optional, defaults to 'error'
    create(config) {
      // Read config values from .guardrail.yaml
      const max = config.number('max', { default: 100 })

      return {
        // visitors...
      }
    },
  })
}
```

The rule ID is what users reference in `.guardrail.yaml`. Use kebab-case by convention: `no-console`, `max-nesting`, etc.

## Visitors

The `create` function returns an object mapping **selectors** to **handler functions**.

```ts
create(config) {
  return {
    selector(node, ctx, report) {
      // called for every matching AST node
    },
  }
}
```

### Selectors

There are two kinds:

**Semantic selectors** — map to language-specific AST node types:

| Selector | Matches |
|----------|---------|
| `function` | Function declarations, expressions, arrow functions, methods |
| `class` | Class declarations |
| `import` | Import statements |
| `branch` | If, for, while, switch, catch, ternary |
| `parameters` | Parameter lists |

**Raw selectors** — match specific tree-sitter node types directly, prefixed with `_`:

| Selector | Matches |
|----------|---------|
| `_string` | Any string literal node |
| `_identifier` | Any identifier node |
| `_call_expression` | Call expression nodes |

Use the exact node type name from the [tree-sitter grammar](https://tree-sitter.github.io/tree-sitter/using-parsers#named-vs-anonymous-nodes) in snake_case after the `_` prefix.

Append `Exit` to any selector to fire when **leaving** the node instead of entering: `functionExit`, `_stringExit`.

### Handler Parameters

```ts
(node: SyntaxNode, ctx: FileContext, report: ReportFn) => void
```

**`node`** — The current AST node:

```ts
node.type          // string — node type name
node.text          // string — source text of this node
node.startPosition // { row: number, column: number } — 0-indexed
node.endPosition   // { row: number, column: number } — 0-indexed
node.childCount    // number
node.child(i)      // SyntaxNode | null
node.namedChild(i) // SyntaxNode | null
node.parent        // SyntaxNode | null
node.isNamed       // boolean
```

**`ctx`** — File context:

```ts
ctx.filename // string
ctx.source   // string — full file contents
ctx.language // { name: string, types: {...} } — language definition
ctx.tree     // tree-sitter Tree object
```

**`report`** — Call this to create a violation:

```ts
report({ message: 'Description of the problem', hint: 'Optional suggestion' })
```

## Config

Users configure your rule in `.guardrail.yaml`:

```yaml
rules:
  my-rule-id:
    max: 50
    enabled: true
    severity: warning
```

Read config values in `create()`:

```ts
config.number(key, { default: 10, min?: 0, max?: 100 })  // number
config.string(key, { default: 'foo', minLength?: 1 })     // string
config.boolean(key, { default: false })                    // boolean
config.enum(key, { values: ['a', 'b'], default: 'a' })    // string | number
```

## Full Example

```ts
// .guardrail/rules/no-console.ts
import type { RegisterFn, SyntaxNode } from '@alexcvzz/guardrail'

export default function(register: RegisterFn) {
  register('no-console', {
    description: 'Disallow console statements',
    defaultSeverity: 'warning',
    create() {
      return {
        _identifier(node: SyntaxNode, ctx, report) {
          if (node.text !== 'console') return
          const parent = node.parent
          if (parent?.type !== 'member_expression') return
          const grandparent = parent.parent
          if (grandparent?.type !== 'call_expression') return
          report({
            message: `Unexpected console call: ${parent.child(2)?.text}`,
          })
        },
      }
    },
  })
}
```

## Template

Copy this to get started:

```ts
// .guardrail/rules/<rule-name>.ts
import type { RegisterFn } from '@alexcvzz/guardrail'

export default function(register: RegisterFn) {
  register('<rule-name>', {
    description: '',
    defaultSeverity: 'error',
    create(config) {
      return {
        function(node, ctx, report) {
          // your logic here
        },
      }
    },
  })
}
```
