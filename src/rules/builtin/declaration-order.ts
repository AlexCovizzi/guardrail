import type { Node, RegisterFn, ReportFn, RuleContext } from '../rule.js'

type DeclarationKind =
  | 'import'
  | 'export'
  | 'interface'
  | 'type'
  | 'enum'
  | 'namespace'
  | 'constant'
  | 'variable'
  | 'function'
  | 'class'

const ALL_KINDS: readonly DeclarationKind[] = [
  'import',
  'export',
  'interface',
  'type',
  'enum',
  'namespace',
  'constant',
  'variable',
  'function',
  'class',
]

export default function registerDeclarationOrder(register: RegisterFn) {
  register('declaration-order', {
    description: 'Top-level declarations should be ordered consistently',
    create(config) {
      const order = config.array('order', {
        values: ALL_KINDS,
        default: ALL_KINDS,
      })

      const rankMap = Object.fromEntries(order.map((k, i) => [k, i]))

      const handler = (root: Node, ctx: RuleContext, report: ReportFn): void => {
        let prevKind: DeclarationKind | null = null
        let prevRank = -1

        for (let i = 0; i < root.namedChildCount; i++) {
          const child = root.namedChild(i)
          if (!child) continue
          const kinds = child.kinds() as DeclarationKind[]
          const kind = order.find((k) => kinds.includes(k as DeclarationKind))
          if (!kind) continue
          const rank = rankMap[kind]
          if (prevKind !== null && rank < prevRank) {
            report({ message: `${kind} should come before ${prevKind}` })
          }
          prevKind = kind as DeclarationKind
          prevRank = rank
        }
      }

      return { _program: handler, _module: handler, _source_file: handler }
    },
  })
}
