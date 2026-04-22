import type { Node, RegisterFn, ReportFn, RuleContext } from '../rule.js'

/**
 * Count consecutive import lines from the top of the file.
 * An import "block" ends when a non-import statement is encountered.
 */
function countImportLines(node: Node): number {
  let lineCount = 0

  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i)
    if (!child) continue

    if (child.is('import')) {
      // Count the span of lines this import covers
      const lines = child.endPosition.row - child.startPosition.row + 1
      lineCount += lines
      continue
    }

    // If we've seen imports and hit a non-import, the block is done
    if (lineCount > 0) break
  }

  return lineCount
}

export default function (register: RegisterFn) {
  register('max-import-lines', {
    description: 'Import sections should not be excessively long',
    defaultSeverity: 'warning',
    create(config) {
      const max = config.number('max', { default: 20, min: 1 })

      return {
        root(node: Node, _ctx: RuleContext, report: ReportFn): void {
          const count = countImportLines(node)
          if (count <= max) return
          report({
            message: `Import section is ${count} lines (max: ${max})`,
            suggestion: `Reduce imports by removing unused imports, or reorganize code to depend on fewer modules. Consider using barrel exports or re-export files.`,
          })
        },
      }
    },
  })
}
