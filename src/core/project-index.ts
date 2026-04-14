import type { SyntaxNode } from '../rules/rule.js'
import { detectLanguage, type LanguageDefinition, type SemanticTypeName } from './language.js'

export interface SearchResult {
  node: SyntaxNode
  context: {
    source: string
    filename: string
    language: LanguageDefinition
  }
}

export interface ProjectContext {
  search(name: string | RegExp, kinds?: SemanticTypeName[]): SearchResult[]
}

export type IndexedKind = 'function' | 'class' | 'import'

const INDEXED_KINDS: IndexedKind[] = ['function', 'class', 'import']

function extractName(node: SyntaxNode): string | null {
  for (let i = 0; i < node.childCount; i++) {
    const child = node.child(i)
    if (child && child.isNamed) return child.text
  }
  return null
}

function findKindForType(nodeType: string, language: LanguageDefinition): IndexedKind | null {
  for (const kind of INDEXED_KINDS) {
    if (language.types[kind].includes(nodeType)) return kind
  }
  return null
}

type Position = { row: number; column: number }

type IndexEntry = {
  filename: string
  nodeType: string
  name: string
  text: string
  startPosition: Position
  endPosition: Position
  isNamed: boolean
}

export interface SerializedIndex {
  entries: IndexEntry[]
}

function makeShallowNode(entry: IndexEntry): SyntaxNode {
  return {
    type: entry.nodeType,
    text: entry.text,
    startPosition: entry.startPosition,
    endPosition: entry.endPosition,
    startIndex: 0,
    endIndex: 0,
    isNamed: entry.isNamed,
    childCount: 0,
    namedChildCount: 0,
    child: () => null,
    namedChild: () => null,
    parent: null,
  }
}

type SearchContext = SearchResult['context']

export class ProjectIndex implements ProjectContext {
  private byKind = new Map<string, Map<string, SearchResult[]>>()

  constructor() {
    for (const kind of INDEXED_KINDS) {
      this.byKind.set(kind, new Map())
    }
  }

  addFile(filename: string, source: string, language: LanguageDefinition, tree: any): void {
    const context = this.buildContext(filename, source, language)
    const root = tree.walk().currentNode

    for (let i = 0; i < root.childCount; i++) {
      const child = root.child(i)!
      const kind = findKindForType(child.type, language)
      if (kind === null) continue

      const name = extractName(child)
      if (name === null) continue

      const kindMap = this.byKind.get(kind)!
      if (!kindMap.has(name)) kindMap.set(name, [])
      kindMap.get(name)!.push({ node: child, context })
    }
  }

  removeFile(filename: string): void {
    for (const kindMap of this.byKind.values()) {
      for (const [name, entries] of kindMap) {
        const filtered = entries.filter((e) => e.context.filename !== filename)
        if (filtered.length === 0) kindMap.delete(name)
        else kindMap.set(name, filtered)
      }
    }
  }

  search(name: string | RegExp, kinds?: SemanticTypeName[]): SearchResult[] {
    const targetKinds = kinds?.length ? (kinds as IndexedKind[]) : INDEXED_KINDS
    const results: SearchResult[] = []

    for (const kind of targetKinds) {
      const kindMap = this.byKind.get(kind)
      if (!kindMap) continue

      if (name === '') {
        for (const entries of kindMap.values()) results.push(...entries)
      } else if (typeof name === 'string') {
        const entries = kindMap.get(name)
        if (entries) results.push(...entries)
      } else {
        for (const [entryName, entries] of kindMap) {
          if (name.test(entryName)) results.push(...entries)
        }
      }
    }

    return results
  }

  serialize(): SerializedIndex {
    const entries: IndexEntry[] = []
    for (const kind of INDEXED_KINDS) {
      const kindMap = this.byKind.get(kind)!
      for (const [name, searchResults] of kindMap) {
        for (const { context, node } of searchResults) {
          entries.push({
            filename: context.filename,
            nodeType: node.type,
            name,
            text: node.text,
            startPosition: node.startPosition,
            endPosition: node.endPosition,
            isNamed: node.isNamed,
          })
        }
      }
    }
    return { entries }
  }

  static fromSerialized(data: SerializedIndex): ProjectIndex {
    const index = new ProjectIndex()
    for (const entry of data.entries) {
      const language = detectLanguage(entry.filename)
      if (!language) continue
      const kind = findKindForType(entry.nodeType, language)
      if (kind === null) continue
      const node = makeShallowNode(entry)
      const context: SearchContext = { source: '', filename: entry.filename, language }
      const kindMap = index.byKind.get(kind)!
      if (!kindMap.has(entry.name)) kindMap.set(entry.name, [])
      kindMap.get(entry.name)!.push({ node, context })
    }
    return index
  }

  private buildContext(filename: string, source: string, language: LanguageDefinition): SearchContext {
    return { source, filename, language }
  }
}
