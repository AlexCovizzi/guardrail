import type { Node, RegisterFn, ReportFn, RuleContext } from '../rule.js'

type CaseStyle = 'camelCase' | 'PascalCase' | 'snake_case' | 'UPPER_SNAKE_CASE'
type StylePreset = 'camelCase' | 'snake_case'
type StyleMap = Record<string, CaseStyle>

const STYLES: Record<StylePreset, StyleMap> = {
  camelCase: {
    function: 'camelCase',
    class: 'PascalCase',
    interface: 'PascalCase',
    type: 'PascalCase',
    enum: 'PascalCase',
    constant: 'UPPER_SNAKE_CASE',
    variable: 'camelCase',
    namespace: 'camelCase',
  },
  snake_case: {
    function: 'snake_case',
    class: 'PascalCase',
    interface: 'PascalCase',
    type: 'PascalCase',
    enum: 'PascalCase',
    constant: 'UPPER_SNAKE_CASE',
    variable: 'snake_case',
    namespace: 'snake_case',
  },
}

const PATTERNS: Record<CaseStyle, RegExp> = {
  camelCase: /^[a-z][a-zA-Z0-9]*$/,
  PascalCase: /^[A-Z][a-zA-Z0-9]*$/,
  snake_case: /^[a-z][a-z0-9]*(_[a-z][a-z0-9]*)*$/,
  UPPER_SNAKE_CASE: /^[A-Z][A-Z0-9]*(_[A-Z][A-Z0-9]*)*$/,
}

function matchesStyle(name: string, style: CaseStyle): boolean {
  return PATTERNS[style].test(name)
}

function describeStyle(style: CaseStyle): string {
  const descriptions: Record<CaseStyle, string> = {
    camelCase: 'camelCase (e.g. myFunction)',
    PascalCase: 'PascalCase (e.g. MyClass)',
    snake_case: 'snake_case (e.g. my_function)',
    UPPER_SNAKE_CASE: 'UPPER_SNAKE_CASE (e.g. MY_CONSTANT)',
  }
  return descriptions[style]
}

/** Strip naming affixes (_ prefix for private, # for JS private fields, _ suffix). */
function stripAffixes(name: string): string {
  return name.replace(/^#/, '').replace(/^_+/, '').replace(/_+$/, '')
}

/** Extract the name from a declaration node via field name or identifier child. */
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

function makeNameChecker(styleMap: StyleMap, report: ReportFn) {
  return (name: string, kind: string, node: Node): void => {
    const expected = styleMap[kind]
    if (!expected) return
    if (name.startsWith('__') && name.endsWith('__')) return
    if (matchesStyle(name, expected)) return
    const stripped = stripAffixes(name)
    if (stripped && matchesStyle(stripped, expected)) return

    report({
      message: `${kind} '${name}' should use ${expected} naming`,
      suggestion: `Rename '${name}' to follow ${describeStyle(expected)}.`,
      node,
    })
  }
}

export default function registerNamingConvention(register: RegisterFn) {
  register('naming-convention', {
    description: 'Enforce consistent naming conventions for declarations',
    defaultSeverity: 'warning',
    create(config) {
      const style = config.enum('style', {
        values: ['camelCase', 'snake_case'] as const,
        default: 'camelCase',
      }) as StylePreset
      const styleMap = STYLES[style]

      const singleNameHandler =
        (kind: string) =>
        (node: Node, _ctx: RuleContext, report: ReportFn): void => {
          const check = makeNameChecker(styleMap, report)
          const name = extractName(node)
          if (name) check(name, kind, node)
        }

      const declarationNamesHandler =
        (kind: string) =>
        (node: Node, _ctx: RuleContext, report: ReportFn): void => {
          const check = makeNameChecker(styleMap, report)
          for (const { name, node: nameNode } of extractNamesFromDeclaration(node)) {
            check(name, kind, nameNode)
          }
        }

      return {
        function: singleNameHandler('function'),
        class: singleNameHandler('class'),
        interface: singleNameHandler('interface'),
        type: singleNameHandler('type'),
        enum: singleNameHandler('enum'),
        constant: declarationNamesHandler('constant'),
        variable: declarationNamesHandler('variable'),
        namespace: singleNameHandler('namespace'),
      }
    },
  })
}
