import type { GlobalPaths, LocalPaths } from '../config/paths.js'
import { globalPaths, localPaths } from '../config/paths.js'

export class Env {
  readonly paths: { global: GlobalPaths; local: LocalPaths }

  private constructor(
    readonly cwd: string,
    readonly homeDir: string
  ) {
    this.paths = { global: globalPaths(homeDir), local: localPaths(cwd) }
  }

  static create(cwd: string, homeDir: string): Env {
    return new Env(cwd, homeDir)
  }
}
