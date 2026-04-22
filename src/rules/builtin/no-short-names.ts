import type { Node, RegisterFn, ReportFn, RuleContext } from '../rule.js'

/** Extract the name from a node via field name or identifier child. */
function extractName(node: Node): string | null {
  const nameField = node.childForFieldName('name')
  if (nameField) return nameField.text

  const idTypes = ['identifier', 'type_identifier', 'property_identifier', 'private_property_identifier']
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i)
    if (child && idTypes.includes(child.type)) return child.text
  }
  return null
}

/** Extract declared names from a variable/constant declaration (handles multi-declarator). */
function extractNamesFromDeclaration(node: Node): Array<{ name: string; node: Node }> {
  const results: Array<{ name: string; node: Node }> = []

  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i)
    if (child?.type === 'variable_declarator') {
      const name = extractName(child)
      if (name) results.push({ name, node: child })
    }
  }

  if (results.length === 0 && node.type === 'assignment') {
    const lhs = node.namedChild(0)
    if (lhs?.type === 'identifier') results.push({ name: lhs.text, node: lhs })
  }

  if (results.length === 0) {
    const direct = extractName(node)
    if (direct) results.push({ name: direct, node })
  }

  return results
}

/** Strip naming affixes (_ prefix for private, # for JS private fields, _ suffix). */
function stripAffixes(name: string): string {
  return name.replace(/^#/, '').replace(/^_+/, '').replace(/_+$/, '')
}

/** Parse a comma-separated string of allowed names into a Set. */
function parseAllowedList(str: string): Set<string> {
  return new Set(
    str
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  )
}

export default function (register: RegisterFn) {
  register('no-short-names', {
    description: 'Disallow overly short variable and function names',
    defaultSeverity: 'warning',
    create(config) {
      const minLength = config.number('minLength', { default: 2, min: 1 })
      const allowedStr = config.string('allowed', { default: 'i,j,k,x,y,z,e,n,m,f,g,r,c' })
      const allowedSet = parseAllowedList(allowedStr)

      function checkName(name: string, kind: string, node: Node, report: ReportFn): void {
        // Dunder names are allowed
        if (name.startsWith('__') && name.endsWith('__')) return

        const stripped = stripAffixes(name)
        const nameToCheck = stripped || name

        // If the name meets the minimum length, it's fine
        if (nameToCheck.length >= minLength) return

        // If it's in the allowed list, it's fine
        if (allowedSet.has(nameToCheck)) return

        report({
          message: `${kind} '${name}' is too short (${nameToCheck.length} char${nameToCheck.length === 1 ? '' : 's'}, min: ${minLength})`,
          suggestion: `Rename '${name}' to something more descriptive. Short names hurt readability outside their immediate context.`,
          node,
        })
      }

      return {
        function(node: Node, _ctx: RuleContext, report: ReportFn): void {
          const name = extractName(node)
          if (!name) return // anonymous functions
          checkName(name, 'function', node, report)
        },

        class(node: Node, _ctx: RuleContext, report: ReportFn): void {
          const name = extractName(node)
          if (!name) return
          checkName(name, 'class', node, report)
        },

        constant(node: Node, _ctx: RuleContext, report: ReportFn): void {
          for (const { name, node: nameNode } of extractNamesFromDeclaration(node)) {
            checkName(name, 'constant', nameNode, report)
          }
        },

        variable(node: Node, _ctx: RuleContext, report: ReportFn): void {
          for (const { name, node: nameNode } of extractNamesFromDeclaration(node)) {
            checkName(name, 'variable', nameNode, report)
          }
        },
      }
    },
  })
}
