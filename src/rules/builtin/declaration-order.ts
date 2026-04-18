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

const ALL_KINDS_WITH_WILDCARD = [...ALL_KINDS, '*'] as const

const isKind = (seg: DeclarationKind | '*'): seg is DeclarationKind => seg !== '*'

export default function registerDeclarationOrder(register: RegisterFn) {
  register('declaration-order', {
    description: 'Top-level declarations should be ordered consistently',
    create(config) {
      const order = config.array('order', {
        values: ALL_KINDS_WITH_WILDCARD,
        default: ['import', '*', 'export'],
      })

      const hasWildcard = order.includes('*')
      const listedKinds = order.filter(isKind)

      const handler = (root: Node, _ctx: RuleContext, report: ReportFn): void => {
        const items = root.namedChildren.map((node) => {
          const kinds = node.kinds() as DeclarationKind[]
          return { node, kind: listedKinds.find((k) => kinds.includes(k)) ?? null }
        })
        const presentKinds = new Set(items.map((i) => i.kind).filter((k): k is DeclarationKind => k !== null))

        // Omit listed kinds absent from this file so [import, *, export] behaves
        // as [import, *] when the file has no exports — otherwise the * zone
        // would be trapped by a listed kind that never appears and trailing
        // unlisted declarations would be wrongly flagged.
        const effectiveOrder = order.filter((seg) => seg === '*' || presentKinds.has(seg))
        const effectiveListedKinds = effectiveOrder.filter(isKind)
        const rankOf = new Map(effectiveListedKinds.map((k, i) => [k, i]))

        const leadingStar = effectiveOrder[0] === '*'
        const trailingStar = effectiveOrder[effectiveOrder.length - 1] === '*'

        const starBetween = new Set<string>()
        {
          let lastListed: DeclarationKind | null = null
          let seenStar = false
          for (const seg of effectiveOrder) {
            if (seg === '*') {
              seenStar = true
              continue
            }
            if (lastListed && seenStar) starBetween.add(`${lastListed}:${seg}`)
            lastListed = seg
            seenStar = false
          }
        }

        const orderStr = order.join(', ')
        let prevListedKind: DeclarationKind | null = null
        const unlistedBuffer: Node[] = []

        for (const { node, kind } of items) {
          if (kind === null) {
            if (hasWildcard) unlistedBuffer.push(node)
            continue
          }

          if (prevListedKind !== null && rankOf.get(kind)! < rankOf.get(prevListedKind)!) {
            report({
              message: `${kind} should come before ${prevListedKind}`,
              suggestion: `Move the ${kind} declaration above the ${prevListedKind}. Expected order: ${orderStr}.`,
              node,
            })
          }

          if (unlistedBuffer.length > 0 && hasWildcard) {
            const validZone = prevListedKind === null ? leadingStar : starBetween.has(`${prevListedKind}:${kind}`)

            if (!validZone) {
              const where = prevListedKind ? `between ${prevListedKind} and ${kind}` : `before ${kind}`
              for (const unlistedNode of unlistedBuffer) {
                report({
                  message: `Declaration appears ${where} but that position has no wildcard in the order`,
                  suggestion: `Move this declaration or add a '*' to the order: ${orderStr}.`,
                  node: unlistedNode,
                })
              }
            }
          }
          unlistedBuffer.length = 0
          prevListedKind = kind
        }

        if (unlistedBuffer.length > 0 && hasWildcard && !trailingStar) {
          for (const unlistedNode of unlistedBuffer) {
            report({
              message: `Declaration appears after ${prevListedKind ?? 'all listed kinds'} but that position has no wildcard in the order`,
              suggestion: `Move this declaration before ${prevListedKind ?? 'listed kinds'} or add a trailing '*' to the order: ${orderStr}.`,
              node: unlistedNode,
            })
          }
        }
      }

      return { root: handler }
    },
  })
}
