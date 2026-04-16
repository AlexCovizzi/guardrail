import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeNode } from '../test/fixtures.js'
import { Cache } from './cache.js'
import { Env } from './env.js'
import { Language } from './language.js'

const ts = Language.TYPESCRIPT!

function makeTestDir(): string {
  const dir = join(tmpdir(), `guardrail-test-cache-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

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

describe('Cache', () => {
  let testDir: string
  let testFile: string

  beforeEach(() => {
    testDir = makeTestDir()
    testFile = join(testDir, 'example.ts')
    writeFileSync(testFile, 'function foo() {}', 'utf-8')
  })

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true })
  })

  describe('load', () => {
    it('returns empty cache when no cache exists', async () => {
      const cache = await Cache.load(Env.create(testDir, testDir))
      expect(cache.getHashes().size).toBe(0)
      expect(cache.getIndex().search('')).toHaveLength(0)
    })

    it('loads existing cache from disk', async () => {
      const cache = await Cache.load(Env.create(testDir, testDir))
      const tree = makeTree(makeNamedNode('function_declaration', 'foo'))
      cache.updateChanged([{ filename: testFile, source: 'fn', language: ts, tree }])
      cache.write()

      const loaded = await Cache.load(Env.create(testDir, testDir))
      expect(loaded.getHashes().has(testFile)).toBe(true)
    })
  })

  describe('diff', () => {
    it('detects new files as changed', async () => {
      const cache = await Cache.load(Env.create(testDir, testDir))
      const { changed, deleted } = cache.diff([testFile])

      expect(changed).toEqual([testFile])
      expect(deleted).toHaveLength(0)
    })

    it('detects unchanged files', async () => {
      const cache = await Cache.load(Env.create(testDir, testDir))
      const tree = makeTree()
      cache.updateChanged([{ filename: testFile, source: 'function foo() {}', language: ts, tree }])
      cache.write()

      const cache2 = await Cache.load(Env.create(testDir, testDir))
      const { changed, deleted } = cache2.diff([testFile])

      expect(changed).toHaveLength(0)
      expect(deleted).toHaveLength(0)
    })

    it('detects modified files as changed', async () => {
      const cache = await Cache.load(Env.create(testDir, testDir))
      cache.updateChanged([{ filename: testFile, source: 'old', language: ts, tree: makeTree() }])
      cache.write()

      writeFileSync(testFile, 'new content', 'utf-8')

      const cache2 = await Cache.load(Env.create(testDir, testDir))
      const { changed } = cache2.diff([testFile])

      expect(changed).toEqual([testFile])
    })

    it('detects deleted files', async () => {
      const cache = await Cache.load(Env.create(testDir, testDir))
      cache.updateChanged([{ filename: testFile, source: 'fn', language: ts, tree: makeTree() }])
      cache.write()

      const otherFile = join(testDir, 'gone.ts')
      writeFileSync(otherFile, 'x', 'utf-8')
      const cache2 = await Cache.load(Env.create(testDir, testDir))
      cache2.updateChanged([{ filename: otherFile, source: 'x', language: ts, tree: makeTree() }])
      cache2.write()

      const cache3 = await Cache.load(Env.create(testDir, testDir))
      const { deleted } = cache3.diff([testFile])

      expect(deleted).toEqual([otherFile])
    })
  })

  describe('updateChanged', () => {
    it('adds files to the index and hash map', async () => {
      const cache = await Cache.load(Env.create(testDir, testDir))
      const fnNode = makeNamedNode('function_declaration', 'foo')
      const tree = makeTree(fnNode)

      cache.updateChanged([{ filename: testFile, source: 'fn', language: ts, tree }])

      expect(cache.getHashes().has(testFile)).toBe(true)
      const results = cache.getIndex().search('foo')
      expect(results).toHaveLength(1)
      expect(results[0].filename).toBe(testFile)
    })

    it('replaces existing entries for the same file', async () => {
      const cache = await Cache.load(Env.create(testDir, testDir))
      const tree1 = makeTree(makeNamedNode('function_declaration', 'old'))
      cache.updateChanged([{ filename: testFile, source: 'v1', language: ts, tree: tree1 }])

      const tree2 = makeTree(makeNamedNode('function_declaration', 'new'))
      cache.updateChanged([{ filename: testFile, source: 'v2', language: ts, tree: tree2 }])

      expect(cache.getIndex().search('old')).toHaveLength(0)
      expect(cache.getIndex().search('new')).toHaveLength(1)
    })
  })

  describe('removeDeleted', () => {
    it('removes entries from the index and hash map', async () => {
      const cache = await Cache.load(Env.create(testDir, testDir))
      cache.updateChanged([
        {
          filename: testFile,
          source: 'fn',
          language: ts,
          tree: makeTree(makeNamedNode('function_declaration', 'foo')),
        },
      ])

      cache.removeDeleted([testFile])

      expect(cache.getHashes().has(testFile)).toBe(false)
      expect(cache.getIndex().search('foo')).toHaveLength(0)
    })
  })

  describe('write', () => {
    it('persists hashes and index to disk', async () => {
      const cache = await Cache.load(Env.create(testDir, testDir))
      cache.updateChanged([
        {
          filename: testFile,
          source: 'fn',
          language: ts,
          tree: makeTree(makeNamedNode('function_declaration', 'foo')),
        },
      ])
      cache.write()

      const loaded = await Cache.load(Env.create(testDir, testDir))
      expect(loaded.getHashes().has(testFile)).toBe(true)
    })

    it('does not write when not dirty', async () => {
      const cache = await Cache.load(Env.create(testDir, testDir))
      cache.updateChanged([
        {
          filename: testFile,
          source: 'fn',
          language: ts,
          tree: makeTree(makeNamedNode('function_declaration', 'foo')),
        },
      ])
      cache.write()

      const loaded = await Cache.load(Env.create(testDir, testDir))
      const indexBefore = JSON.stringify(loaded.getIndex().serialize())
      loaded.write()
      const loaded2 = await Cache.load(Env.create(testDir, testDir))
      const indexAfter = JSON.stringify(loaded2.getIndex().serialize())

      expect(indexBefore).toEqual(indexAfter)
    })
  })

  describe('full lifecycle', () => {
    it('handles add, cache, modify, re-diff', async () => {
      const cache = await Cache.load(Env.create(testDir, testDir))
      cache.updateChanged([
        {
          filename: testFile,
          source: 'function foo() {}',
          language: ts,
          tree: makeTree(makeNamedNode('function_declaration', 'foo')),
        },
      ])
      cache.write()

      const cache2 = await Cache.load(Env.create(testDir, testDir))
      const { changed: changed2 } = cache2.diff([testFile])
      expect(changed2).toHaveLength(0)

      writeFileSync(testFile, 'function bar() {}', 'utf-8')

      const cache3 = await Cache.load(Env.create(testDir, testDir))
      const { changed: changed3 } = cache3.diff([testFile])
      expect(changed3).toEqual([testFile])

      cache3.updateChanged([
        {
          filename: testFile,
          source: 'function bar() {}',
          language: ts,
          tree: makeTree(makeNamedNode('function_declaration', 'bar')),
        },
      ])

      expect(cache3.getIndex().search('foo')).toHaveLength(0)
      expect(cache3.getIndex().search('bar')).toHaveLength(1)
    })
  })
})
