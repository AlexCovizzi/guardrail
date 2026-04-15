import { detectLanguage, type LanguageDefinition, nodeTypesFor } from './language.js'
import type { SemanticKind } from './languages/types.js'
import { Node } from './node.js'

export interface SearchResult {
  node: Node
  context: {
    source: string
    filename: string
    language: LanguageDefinition
  }
}

export interface ProjectContext {
  search(name: string | RegExp, kinds?: SemanticKind[]): SearchResult[]
}

export type IndexedKind = 'function' | 'class' | 'import'

const INDEXED_KINDS: IndexedKind[] = ['function', 'class', 'import']

type Position = { row: number; column: number }

interface InternalEntry {
  filename: string
  nodeType: string
  name: string
  text: string
  startPosition: Position
  endPosition: Position
  isNamed: boolean
  language: LanguageDefinition
  source: string
}

function extractName(rawNode: any): string | null {
  for (let i = 0; i < rawNode.childCount; i++) {
    const child = rawNode.child(i)
    if (child && child.isNamed) return child.text
  }
  return null
}

function findKindForType(nodeType: string, language: LanguageDefinition): IndexedKind | null {
  for (const kind of INDEXED_KINDS) {
    if (nodeTypesFor(language, kind as SemanticKind).includes(nodeType)) return kind
  }
  return null
}

function makeShallowNode(entry: InternalEntry): Node {
  const mockRaw = {
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
  }
  return new Node(mockRaw as any, entry.language)
}

export interface SerializedIndex {
  entries: Array<{
    filename: string
    nodeType: string
    name: string
    text: string
    startPosition: Position
    endPosition: Position
    isNamed: boolean
  }>
}

export class ProjectIndex implements ProjectContext {
  private byKind = new Map<string, Map<string, InternalEntry[]>>()

  constructor() {
    for (const kind of INDEXED_KINDS) {
      this.byKind.set(kind, new Map())
    }
  }

  addFile(filename: string, source: string, language: LanguageDefinition, tree: any): void {
    const root = tree.rootNode
    for (let i = 0; i < root.childCount; i++) {
      const child = root.child(i)
      if (!child) continue
      const kind = findKindForType(child.type, language)
      if (kind === null) continue
      const name = extractName(child)
      if (name === null) continue
      const entry: InternalEntry = {
        filename,
        nodeType: child.type,
        name,
        text: child.text,
        startPosition: child.startPosition,
        endPosition: child.endPosition,
        isNamed: child.isNamed,
        language,
        source,
      }
      const kindMap = this.byKind.get(kind)!
      if (!kindMap.has(name)) kindMap.set(name, [])
      kindMap.get(name)!.push(entry)
    }
  }

  removeFile(filename: string): void {
    for (const kindMap of this.byKind.values()) {
      for (const [name, entries] of kindMap) {
        const filtered = entries.filter((e) => e.filename !== filename)
        if (filtered.length === 0) kindMap.delete(name)
        else kindMap.set(name, filtered)
      }
    }
  }

  search(name: string | RegExp, kinds?: SemanticKind[]): SearchResult[] {
    const targetKinds = kinds?.length ? (kinds as IndexedKind[]) : INDEXED_KINDS
    const results: SearchResult[] = []
    for (const kind of targetKinds) {
      const kindMap = this.byKind.get(kind)
      if (!kindMap) continue
      results.push(...this.matchEntries(kindMap, name))
    }
    return results
  }

  serialize(): SerializedIndex {
    const entries: SerializedIndex['entries'] = []
    for (const kind of INDEXED_KINDS) {
      const kindMap = this.byKind.get(kind)!
      for (const [, entryList] of kindMap) {
        for (const entry of entryList) {
          entries.push({
            filename: entry.filename,
            nodeType: entry.nodeType,
            name: entry.name,
            text: entry.text,
            startPosition: entry.startPosition,
            endPosition: entry.endPosition,
            isNamed: entry.isNamed,
          })
        }
      }
    }
    return { entries }
  }

  static fromSerialized(data: SerializedIndex): ProjectIndex {
    const index = new ProjectIndex()
    for (const raw of data.entries) {
      const language = detectLanguage(raw.filename)
      if (!language) continue
      const kind = findKindForType(raw.nodeType, language)
      if (kind === null) continue
      const entry: InternalEntry = { ...raw, language, source: '' }
      const kindMap = index.byKind.get(kind)!
      if (!kindMap.has(entry.name)) kindMap.set(entry.name, [])
      kindMap.get(entry.name)!.push(entry)
    }
    return index
  }

  private matchEntries(kindMap: Map<string, InternalEntry[]>, name: string | RegExp): SearchResult[] {
    const toResult = (entry: InternalEntry): SearchResult => ({
      node: makeShallowNode(entry),
      context: { source: entry.source, filename: entry.filename, language: entry.language },
    })

    if (name === '') {
      const results: SearchResult[] = []
      for (const entries of kindMap.values()) results.push(...entries.map(toResult))
      return results
    } else if (typeof name === 'string') {
      const entries = kindMap.get(name)
      return entries ? entries.map(toResult) : []
    } else {
      const results: SearchResult[] = []
      for (const [entryName, entries] of kindMap) {
        if (name.test(entryName)) results.push(...entries.map(toResult))
      }
      return results
    }
  }
}