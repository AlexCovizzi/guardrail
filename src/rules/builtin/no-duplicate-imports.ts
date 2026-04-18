import type { Node, RegisterFn, ReportFn, RuleContext } from '../rule.js'

/**
 * Extract the source module/path from an import node.
 *
 * - JS/TS: child with type "string" (e.g. `'react'`)
 * - Python import_statement: first "dotted_name" child (e.g. `os`)
 * - Python import_from_statement: first "dotted_name" child (e.g. `sys`)
 * - Java/Kotlin: "scoped_identifier" child (e.g. `java.util.List`)
 * - Fallback: the node's own text
 */
function extractSource(node: Node): string {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (!child) continue
    if (child.type === 'string' || child.type === 'dotted_name' || child.type === 'scoped_identifier') {
      return child.text
    }
  }
  return node.text
}

export default function (register: RegisterFn) {
  register('no-duplicate-imports', {
    description: 'Disallow multiple import statements from the same source',
    create() {
      return {
        root(node: Node, _ctx: RuleContext, report: ReportFn): void {
          const seen = new Map<string, Node>()

          for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i)
            if (!child || !child.is('import')) continue

            const source = extractSource(child)
            const first = seen.get(source)
            if (first) {
              report({
                message: `Multiple imports from ${source}`,
                suggestion: `Merge this import with the existing import from ${source}.`,
                node: child,
              })
            } else {
              seen.set(source, child)
            }
          }
        },
      }
    },
  })
}
