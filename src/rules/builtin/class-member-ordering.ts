import type { RegisterFn, ReportFn, RuleContext, Node } from '../rule.js'

type Kind = 'field' | 'constructor' | 'method'
type Staticness = 'static' | 'instance'
type Accessor = 'public' | 'protected' | 'private' | '#private'
type OrderPreset = 'fields-first' | 'accessor-first' | 'static-first'

interface MemberClassification {
  kind: Kind
  staticness: Staticness
  accessor: Accessor
  name: string
}

const KIND_RANK: Record<Kind, number> = { field: 0, constructor: 1, method: 2 }
const STATICNESS_RANK: Record<Staticness, number> = { static: 0, instance: 1 }
const ACCESSOR_RANK: Record<Accessor, number> = { public: 0, protected: 1, private: 2, '#private': 3 }

const PRECEDENCE_WEIGHTS: Record<OrderPreset, Array<{ dim: 'kind' | 'staticness' | 'accessor'; weight: number }>> = {
  'fields-first': [
    { dim: 'kind', weight: 100 },
    { dim: 'staticness', weight: 10 },
    { dim: 'accessor', weight: 1 },
  ],
  'accessor-first': [
    { dim: 'accessor', weight: 100 },
    { dim: 'kind', weight: 10 },
    { dim: 'staticness', weight: 1 },
  ],
  'static-first': [
    { dim: 'staticness', weight: 100 },
    { dim: 'kind', weight: 10 },
    { dim: 'accessor', weight: 1 },
  ],
}

function getAccessor(node: Node): Accessor {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (!child) continue
    if (child.type === 'accessibility_modifier') {
      const text = child.text
      if (text === 'public' || text === 'protected' || text === 'private') return text
    }
    if (child.type === 'private_property_identifier') return '#private'
  }
  return 'public'
}

function isStatic(node: Node): boolean {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child && child.type === 'static') return true
  }
  return false
}

function getName(node: Node): string {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child && (child.type === 'property_identifier' || child.type === 'private_property_identifier')) {
      return child.text
    }
  }
  return node.text
}

function classifyFieldLike(node: Node): MemberClassification {
  return {
    kind: 'field',
    accessor: getAccessor(node),
    staticness: isStatic(node) ? 'static' : 'instance',
    name: getName(node),
  }
}

function classifyMethodLike(node: Node, forceInstance: boolean): MemberClassification {
  const name = getName(node)
  if (name === 'constructor') {
    return { kind: 'constructor', accessor: 'public', staticness: 'instance', name }
  }
  return {
    kind: 'method',
    accessor: getAccessor(node),
    staticness: forceInstance ? 'instance' : isStatic(node) ? 'static' : 'instance',
    name,
  }
}

function classifyMember(node: Node): MemberClassification | null {
  const t = node.type

  if (t === 'public_field_definition' || t === 'field_definition') return classifyFieldLike(node)
  if (t === 'method_definition' || t === 'method_signature') return classifyMethodLike(node, false)
  if (t === 'abstract_method_signature') return classifyMethodLike(node, true)
  if (t === 'class_static_block') {
    return { kind: 'field', accessor: 'public', staticness: 'static', name: '<static block>' }
  }
  if (t === 'index_signature') {
    return { kind: 'field', accessor: 'public', staticness: 'static', name: '<index signature>' }
  }
  return null
}

function computeRank(classification: MemberClassification, preset: OrderPreset): number {
  let rank = 0
  for (const { dim, weight } of PRECEDENCE_WEIGHTS[preset]) {
    if (dim === 'kind') rank += KIND_RANK[classification.kind] * weight
    else if (dim === 'staticness') rank += STATICNESS_RANK[classification.staticness] * weight
    else rank += ACCESSOR_RANK[classification.accessor] * weight
  }
  return rank
}

function describeMember(classification: MemberClassification): string {
  if (classification.kind === 'constructor') return 'constructor'

  const parts: string[] = []
  if (classification.accessor !== 'public') parts.push(classification.accessor)
  if (classification.staticness === 'static') parts.push('static')
  parts.push(classification.kind)
  return parts.join(' ')
}

function classifyMembersFromClass(node: Node, preset: OrderPreset) {
  let body: Node | null = null
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child && child.type === 'class_body') {
      body = child
      break
    }
  }
  if (!body) return []

  const members: Array<{ classification: MemberClassification; node: Node; rank: number }> = []
  for (let i = 0; i < body.namedChildCount; i++) {
    const child = body.namedChild(i)
    if (!child) continue
    const classification = classifyMember(child)
    if (!classification) continue
    members.push({ classification, node: child, rank: computeRank(classification, preset) })
  }
  return members
}

export default function registerClassMemberOrdering(register: RegisterFn) {
  register('class-member-ordering', {
    description: 'Class members should be ordered consistently',
    create(config) {
      const order = config.enum('order', {
        values: ['fields-first', 'accessor-first', 'static-first'] as const,
        default: 'fields-first',
      }) as OrderPreset

      return {
        class(node: Node, ctx: RuleContext, report: ReportFn): void {
          const members = classifyMembersFromClass(node, order)

          for (let i = 1; i < members.length; i++) {
            const prev = members[i - 1]
            const curr = members[i]
            if (curr.rank < prev.rank) {
              report({
                message: `${describeMember(curr.classification)} '${curr.classification.name}' should come before ${describeMember(prev.classification)} '${prev.classification.name}'`,
              })
            }
          }
        },
      }
    },
  })
}
