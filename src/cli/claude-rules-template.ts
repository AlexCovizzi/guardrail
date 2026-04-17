export const RULES_TEMPLATE = `# Guardrail Custom Rules

This file explains how to write custom Guardrail rules. Guardrail checks every file edit automatically — add rules here to catch patterns specific to your project.

## Quick Start

Scaffold a rule:

\`\`\`bash
guardrail rule add my-rule
guardrail rule add my-rule --scope local   # project-local
\`\`\`

This creates a \`.ts\` file in \`~/.guardrail/rules/\` (global) or \`.guardrail/rules/\` (local).

## Rule Structure

Every rule file exports a default function that receives a \`register\` callback:

\`\`\`ts
import type { RegisterFn } from '@alexcvzz/guardrail'

export default function(register: RegisterFn) {
  register('my-rule-id', {
    description: 'What this rule checks',
    defaultSeverity: 'error', // or 'warning'
    create(config) {
      return {
        // visitors — see below
      }
    },
  })
}
\`\`\`

Rule IDs are what users put in \`.guardrail.yaml\`. Use kebab-case: \`no-console\`, \`max-nesting\`, etc.

## Selectors

Handlers in the \`create\` return object map **selectors** to functions called for each matching AST node.

**Semantic selectors** (work across all languages):

| Selector | Matches |
|----------|---------|
| \`function\` | Function declarations, expressions, arrow functions, methods |
| \`class\` | Class declarations |
| \`import\` | Import statements |
| \`branch\` | If, for, while, switch, catch, ternary |
| \`parameters\` | Parameter lists |

**Raw selectors** — match tree-sitter node types directly, prefixed with \`_\`:

\`\`\`ts
_string          // string literal nodes
_identifier      // identifier nodes
_call_expression  // call expression nodes
\`\`\`

Append \`Exit\` to fire on node exit: \`functionExit\`, \`_stringExit\`.

## Handler Parameters

\`\`\`ts
(node, ctx, report) => {
  node.type          // node type name
  node.text          // source text of this node
  node.startPosition // { row, column } — 0-indexed
  node.endPosition   // { row, column } — 0-indexed
  node.childCount    // number
  node.child(i)      // SyntaxNode | null
  node.namedChild(i) // SyntaxNode | null
  node.parent        // SyntaxNode | null

  ctx.filename       // string
  ctx.source         // full file contents
  ctx.language       // language definition

  report({
    message: 'Description of the problem',
    suggestion: 'Brief, actionable fix guidance',  // optional
  })
}
\`\`\`

## Config

Users configure your rule in \`.guardrail.yaml\`:

\`\`\`yaml
rules:
  my-rule-id:
    max: 50
    severity: warning
\`\`\`

Read values in \`create()\`:

\`\`\`ts
config.number(key, { default: 10, min?: 0, max?: 100 })
config.string(key, { default: 'foo', minLength?: 1 })
config.boolean(key, { default: false })
config.enum(key, { values: ['a', 'b'], default: 'a' })
\`\`\`

## Example: No Console Calls

\`\`\`ts
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
          report({ message: 'Unexpected console call', suggestion: 'Remove the console call or replace with a logging library.' })
        },
      }
    },
  })
}
\`\`\`

## Running Checks

\`\`\`bash
guardrail check                    # check current directory
guardrail check src/**/*.ts        # check specific files
\`\`\`
`
