import type { Node, RegisterFn, ReportFn, RuleContext } from '../rule.js'

export default function registerNoMagicNumbers(register: RegisterFn) {
  register('no-magic-numbers', {
    description: 'Disallow unnamed numeric literals',
    defaultSeverity: 'warning',
    create(config) {
      const ignoreStr = config.string('ignore', { default: '0,1' })
      const ignoreSet = new Set(
        ignoreStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      )

      const reportMagicNumbers = (node: Node, _: RuleContext, report: ReportFn) => {
        if (ignoreSet.has(node.text)) return
        report({
          message: `Magic number: ${node.text}`,
          suggestion: `Extract this number into a named constant for clarity.`,
          node,
        })
      }

      const silenceNumbers = () => ({ number: (): void => {} })

      return {
        constant: silenceNumbers,
        variable: silenceNumbers,
        enum: silenceNumbers,
        import: silenceNumbers,
        parameters: silenceNumbers,
        // Re-enables reporting inside functions nested in silenced scopes (e.g. `const f = () => 42`).
        function: () => ({ number: reportMagicNumbers }),
        number: reportMagicNumbers,
      }
    },
  })
}
