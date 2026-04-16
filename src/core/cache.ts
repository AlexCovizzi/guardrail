import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Env } from './env.js'
import type { LanguageDefinition } from './language.js'
import { ProjectIndex, type SerializedIndex } from './project-index.js'

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex')
}

function projectCacheDir(cwd: string, cacheBaseDir: string): string {
  const hash = hashContent(cwd)
  return join(cacheBaseDir, hash)
}

export class Cache {
  private dirty = false

  private constructor(
    private readonly dir: string,
    private readonly hashes: Map<string, string>,
    private readonly index: ProjectIndex
  ) {}

  // used in tests
  static inMemory(dir = '', hashes = new Map(), index = new ProjectIndex()): Cache {
    return new Cache(dir, hashes, index)
  }

  static async load(env: Env): Promise<Cache> {
    const { cacheDir } = env.paths.global
    const dir = projectCacheDir(env.cwd, cacheDir)

    const hashes = new Map<string, string>()
    let index = new ProjectIndex()

    const hashesFile = join(dir, 'hashes.json')
    const indexFile = join(dir, 'index.json')

    if (existsSync(hashesFile) && existsSync(indexFile)) {
      try {
        const hashesData = JSON.parse(readFileSync(hashesFile, 'utf-8')) as Record<string, string>
        for (const [k, v] of Object.entries(hashesData)) hashes.set(k, v)

        const indexData = JSON.parse(readFileSync(indexFile, 'utf-8')) as SerializedIndex
        index = ProjectIndex.fromSerialized(indexData)
      } catch {
        // Corrupt cache, start fresh
      }
    }

    return new Cache(dir, hashes, index)
  }

  diff(allFiles: string[]): { changed: string[]; deleted: string[] } {
    const changed: string[] = []
    const deleted: string[] = []

    const currentFiles = new Set(allFiles)

    for (const file of allFiles) {
      try {
        const content = readFileSync(file, 'utf-8')
        const hash = hashContent(content)
        const cached = this.hashes.get(file)
        if (cached !== hash) {
          changed.push(file)
        }
      } catch {
        // Can't read, skip
      }
    }

    for (const file of this.hashes.keys()) {
      if (!currentFiles.has(file)) deleted.push(file)
    }

    return { changed, deleted }
  }

  updateChanged(files: { filename: string; source: string; language: LanguageDefinition; tree: any }[]): void {
    for (const { filename, source, language, tree } of files) {
      this.hashes.set(filename, hashContent(source))
      this.index.removeFile(filename)
      this.index.addFile(filename, source, language, tree)
      this.dirty = true
    }
  }

  removeDeleted(filenames: string[]): void {
    for (const file of filenames) {
      this.hashes.delete(file)
      this.index.removeFile(file)
      this.dirty = true
    }
  }

  write(): void {
    if (!this.dirty || !this.dir) return

    mkdirSync(this.dir, { recursive: true })

    const hashesObj: Record<string, string> = {}
    for (const [k, v] of this.hashes) hashesObj[k] = v

    writeFileSync(join(this.dir, 'hashes.json'), JSON.stringify(hashesObj))
    writeFileSync(join(this.dir, 'index.json'), JSON.stringify(this.index.serialize()))
    this.dirty = false
  }

  getIndex(): ProjectIndex {
    return this.index
  }

  getHashes(): Map<string, string> {
    return this.hashes
  }
}
