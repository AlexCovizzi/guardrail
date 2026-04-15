import { beforeEach, describe, expect, it } from 'vitest'
import { makeNode } from '../test/fixtures.js'
import { Language } from './language.js'
import { ProjectIndex } from './project-index.js'

const ts = Language.TYPESCRIPT!

function makeTree(...children: any[]): any {
  const root = makeNode('program', {
    childCount: children.length,
    child: (i: number) => children[i] ?? null,
  })
  return { rootNode: root, walk: () => ({ currentNode: root }) }
}

function makeNamedNode(type: string, name: string): any {
  const nameChild = makeNode('identifier', { text: name, isNamed: true })
  return makeNode(type, { childCount: 1, child: () => nameChild, isNamed: true })
}

describe('ProjectIndex addFile', () => {
  it('indexes top-level functions by name', () => {
    const index = new ProjectIndex()
    const fnNode = makeNamedNode('function_declaration', 'myFunc')
    index.addFile('file.ts', '', ts, makeTree(fnNode))

    const results = index.search('myFunc')
    expect(results).toHaveLength(1)
    expect(results[0].node.type).toBe('function_declaration')
    expect(results[0].filename).toBe('file.ts')
  })

  it('indexes classes and imports', () => {
    const index = new ProjectIndex()
    const cls = makeNamedNode('class_declaration', 'MyClass')
    const imp = makeNamedNode('import_statement', './utils')
    index.addFile('file.ts', '', ts, makeTree(cls, imp))

    expect(index.search('MyClass')).toHaveLength(1)
    expect(index.search('./utils')).toHaveLength(1)
  })

  it('skips nodes without named children', () => {
    const index = new ProjectIndex()
    const fnNode = makeNode('function_declaration', { childCount: 0, child: () => null })
    index.addFile('file.ts', '', ts, makeTree(fnNode))

    expect(index.search('')).toHaveLength(0)
  })

  it('ignores non-indexed node types', () => {
    const index = new ProjectIndex()
    const varNode = makeNamedNode('variable_declaration', 'x')
    index.addFile('file.ts', '', ts, makeTree(varNode))

    expect(index.search('x')).toHaveLength(0)
  })
})

describe('ProjectIndex addFile scoping', () => {
  it('only indexes top-level children, not nested', () => {
    const index = new ProjectIndex()
    const innerFn = makeNamedNode('function_declaration', 'inner')
    const outerFn = makeNode('function_declaration', {
      childCount: 1,
      child: () => innerFn,
      isNamed: true,
    })
    index.addFile('file.ts', '', ts, makeTree(outerFn))

    expect(index.search('outer')).toHaveLength(0)
    expect(index.search('inner')).toHaveLength(0)
  })

  it('indexes multiple files with same name', () => {
    const index = new ProjectIndex()
    index.addFile('a.ts', '', ts, makeTree(makeNamedNode('function_declaration', 'foo')))
    index.addFile('b.ts', '', ts, makeTree(makeNamedNode('function_declaration', 'foo')))

    const results = index.search('foo')
    expect(results).toHaveLength(2)
    expect(results.map((r) => r.filename).sort()).toEqual(['a.ts', 'b.ts'])
  })
})

describe('ProjectIndex removeFile', () => {
  it('removes all entries for a file', () => {
    const index = new ProjectIndex()
    const fn = makeNamedNode('function_declaration', 'foo')
    const cls = makeNamedNode('class_declaration', 'Bar')
    index.addFile('a.ts', '', ts, makeTree(fn, cls))

    index.removeFile('a.ts')

    expect(index.search('foo')).toHaveLength(0)
    expect(index.search('Bar')).toHaveLength(0)
  })

  it('keeps entries from other files with same name', () => {
    const index = new ProjectIndex()
    index.addFile('a.ts', '', ts, makeTree(makeNamedNode('function_declaration', 'foo')))
    index.addFile('b.ts', '', ts, makeTree(makeNamedNode('function_declaration', 'foo')))

    index.removeFile('a.ts')

    const results = index.search('foo')
    expect(results).toHaveLength(1)
    expect(results[0].filename).toBe('b.ts')
  })
})

describe('ProjectIndex search', () => {
  let index: ProjectIndex

  beforeEach(() => {
    index = new ProjectIndex()
    const fn = makeNamedNode('function_declaration', 'getService')
    const cls = makeNamedNode('class_declaration', 'Service')
    const imp = makeNamedNode('import_statement', './service')
    index.addFile('file.ts', '', ts, makeTree(fn, cls, imp))
  })

  it('matches by exact string', () => {
    expect(index.search('getService')).toHaveLength(1)
    expect(index.search('getServiceX')).toHaveLength(0)
    expect(index.search('get')).toHaveLength(0)
  })

  it('matches by regex', () => {
    const results = index.search(/Service$/)
    expect(results).toHaveLength(2)
  })

  it('returns all with empty string', () => {
    expect(index.search('')).toHaveLength(3)
  })

  it('filters by kind', () => {
    expect(index.search('Service', ['class'])).toHaveLength(1)
    expect(index.search('Service', ['function'])).toHaveLength(0)
    expect(index.search('Service', ['class', 'function'])).toHaveLength(1)
  })

  it('searches all kinds when kinds omitted or empty', () => {
    expect(index.search('Service')).toHaveLength(1)
    expect(index.search('Service', [])).toHaveLength(1)
  })

  it('returns empty when nothing matches', () => {
    expect(index.search('nonexistent')).toHaveLength(0)
  })

  it('returns empty on empty index', () => {
    expect(new ProjectIndex().search('')).toHaveLength(0)
  })
})

describe('ProjectIndex serialize / fromSerialized', () => {
  it('round-trips through serialization', () => {
    const index = new ProjectIndex()
    const fn = makeNamedNode('function_declaration', 'foo')
    const cls = makeNamedNode('class_declaration', 'Bar')
    index.addFile('file.ts', 'source', ts, makeTree(fn, cls))

    const restored = ProjectIndex.fromSerialized(index.serialize())

    expect(restored.search('foo')).toHaveLength(1)
    expect(restored.search('Bar')).toHaveLength(1)
    expect(restored.search('Bar', ['class'])[0].filename).toBe('file.ts')
  })

  it('skips entries for unknown file extensions', () => {
    const index = new ProjectIndex()
    index.addFile('file.ts', '', ts, makeTree(makeNamedNode('function_declaration', 'foo')))

    const serialized = index.serialize()
    serialized.entries[0].filename = 'file.unknown'

    expect(ProjectIndex.fromSerialized(serialized).search('foo')).toHaveLength(0)
  })

  it('preserves duplicate names across files', () => {
    const index = new ProjectIndex()
    index.addFile('a.ts', '', ts, makeTree(makeNamedNode('function_declaration', 'foo')))
    index.addFile('b.ts', '', ts, makeTree(makeNamedNode('function_declaration', 'foo')))

    const restored = ProjectIndex.fromSerialized(index.serialize())

    expect(restored.search('foo')).toHaveLength(2)
    expect(
      restored
        .search('foo')
        .map((r) => r.filename)
        .sort()
    ).toEqual(['a.ts', 'b.ts'])
  })
})
