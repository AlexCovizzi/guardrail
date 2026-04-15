import type { LanguageDefinition } from '../../core/language.js'
import type { RegisterFn, ReportFn, RuleContext, SyntaxNode } from '../rule.js'

// --- Types ---

type DeclarationKind = 'import' | 'interface' | 'type' | 'enum' | 'namespace' | 'constant' | 'variable' | 'function' | 'class'

const ALL_KINDS: readonly DeclarationKind[] = [
  'import',
  'interface',
  'type',
  'enum',
  'namespace',
  'constant',
  'variable',
  'function',
  'class',
]

const DECLARATION_KINDS = new Set<string>(ALL_KINDS)

// --- Build reverse map: AST node type → declaration kind from language types ---

function buildTypeToKindMap(
  semanticTypes: LanguageDefinition['types'],
  extras: Record<string, DeclarationKind>,
): Record<string, DeclarationKind> {
  const map: Record<string, DeclarationKind> = {}
  for (const [semantic, nodeTypes] of Object.entries(semanticTypes)) {
    if (!DECLARATION_KINDS.has(semantic) || !nodeTypes) continue
    for (const nodeType of nodeTypes) {
      map[nodeType] = semantic as DeclarationKind
    }
  }
  for (const [nodeType, kind] of Object.entries(extras)) {
    map[nodeType] = kind
  }
  return map
}

// --- Per-language overrides for ambiguous/contextual types ---

const JS_EXTRAS: Record<string, DeclarationKind> = {
  lexical_declaration: 'constant', // const vs let/var resolved at classification time
  export_statement: 'import',       // unwrapped at classification time
}

const TS_EXTRAS: Record<string, DeclarationKind> = JS_EXTRAS

const PYTHON_EXTRAS: Record<string, DeclarationKind> = {
  assignment: 'variable', // module-level assignments
}

const JAVA_EXTRAS: Record<string, DeclarationKind> = {}

const KOTLIN_EXTRAS: Record<string, DeclarationKind> = {
  property_declaration: 'constant',  // val vs var resolved at classification time
  object_declaration: 'enum',        // override: in types.class but ordered as enum
}

const LANGUAGE_EXTRAS: Record<string, Record<string, DeclarationKind>> = {
  javascript: JS_EXTRAS,
  jsx: JS_EXTRAS,
  typescript: TS_EXTRAS,
  tsx: TS_EXTRAS,
  python: PYTHON_EXTRAS,
  java: JAVA_EXTRAS,
  kotlin: KOTLIN_EXTRAS,
}

// --- AST helpers ---

function findChildByType(node: SyntaxNode, type: string): SyntaxNode | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child && child.type === type) return child
  }
  return null
}

function findNamedChild(node: SyntaxNode, skipTypes: Set<string>): SyntaxNode | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child && !skipTypes.has(child.type)) return child
  }
  return null
}

const EXPORT_SKIP_TYPES = new Set(['export', 'default', 'declare', ';'])

// --- Export statement unwrapping (JS/TS) ---

function unwrapExportKind(node: SyntaxNode, typeMap: Record<string, DeclarationKind>): DeclarationKind {
  const inner = findNamedChild(node, EXPORT_SKIP_TYPES)
  if (!inner) return 'import'

  if (inner.type === 'lexical_declaration') {
    return findChildByType(inner, 'const') !== null ? 'constant' : 'variable'
  }

  if (inner.type === 'import_statement') return 'import'

  return typeMap[inner.type] ?? 'import'
}

// --- Contextual overrides ---

function classifyKotlinClassDeclaration(node: SyntaxNode): DeclarationKind {
  if (findChildByType(node, 'interface') !== null) return 'interface'
  if (findChildByType(node, 'enum') !== null) return 'enum'
  if (findChildByType(node, 'annotation') !== null) return 'interface'
  return 'class'
}

function classifyExpressionStatement(node: SyntaxNode, lang: string, typeMap: Record<string, DeclarationKind>): DeclarationKind | null {
  const inner = node.child(0)
  if (!inner) return null
  const kind = typeMap[inner.type]
  if (kind) return kind
  if (inner.type === 'assignment' && lang === 'python') return 'variable'
  return null
}

// --- classifyDeclaration ---

function classifyDeclaration(node: SyntaxNode, language: string, typeMap: Record<string, DeclarationKind>): DeclarationKind | null {
  const lang = language.toLowerCase()

  // JS/TS: unwrap export_statement
  if (node.type === 'export_statement') {
    return unwrapExportKind(node, typeMap)
  }

  //lexical_declaration: const vs let/var — resolve before typeMap lookup
  if (node.type === 'lexical_declaration') {
    return findChildByType(node, 'const') !== null ? 'constant' : 'variable'
  }

  // Direct lookup
  const kind = typeMap[node.type]
  if (kind) {
    // Kotlin: var property → variable
    if (lang === 'kotlin' && node.type === 'property_declaration') {
      if (findChildByType(node, 'var') !== null) return 'variable'
    }
    return kind
  }

  // Contextual: expression_statement containing a mapped child
  if (node.type === 'expression_statement') {
    return classifyExpressionStatement(node, lang, typeMap)
  }

  // Contextual: Kotlin class_declaration with interface/enum/annotation modifiers
  if (lang === 'kotlin' && node.type === 'class_declaration') {
    return classifyKotlinClassDeclaration(node)
  }

  return null
}

// --- walkProgram ---

function walkProgram(node: SyntaxNode, ctx: RuleContext, report: ReportFn, kindRanks: Record<string, number>): void {
  const extras = LANGUAGE_EXTRAS[ctx.language.name.toLowerCase()] ?? {}
  const typeMap = buildTypeToKindMap(ctx.language.types, extras)
  let prevKind: DeclarationKind | null = null
  let prevRank = -1

  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i)
    if (!child) continue
    const kind = classifyDeclaration(child, ctx.language.name, typeMap)
    if (!kind) continue
    const rank = kindRanks[kind] ?? 999
    if (prevKind !== null && rank < prevRank) {
      report({ message: `${kind} should come before ${prevKind}` })
    }
    prevKind = kind
    prevRank = rank
  }
}

// --- Rule registration ---

export default function registerDeclarationOrder(register: RegisterFn) {
  register('declaration-order', {
    description: 'Top-level declarations should be ordered consistently',
    create(config) {
      const order = config.array('order', {
        values: ALL_KINDS,
        default: ALL_KINDS,
      })

      const kindRanks: Record<string, number> = {}
      for (let i = 0; i < order.length; i++) {
        kindRanks[order[i]] = i
      }

      const handler = (node: SyntaxNode, ctx: RuleContext, report: ReportFn): void => {
        walkProgram(node, ctx, report, kindRanks)
      }

      return {
        _program: handler,
        _module: handler,
        _source_file: handler,
      }
    },
  })
}
