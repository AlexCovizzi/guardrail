import { join } from 'node:path'

export interface GlobalPaths {
  configDir: string
  configPath: string
  rulesDir: string
  cacheDir: string
}

export interface LocalPaths {
  configDir: string
  rulesDir: string
}

export function globalPaths(home: string): GlobalPaths {
  const configDir = join(home, '.guardrail')
  return {
    configDir,
    configPath: join(configDir, 'config.yaml'),
    rulesDir: join(configDir, 'rules'),
    cacheDir: join(configDir, 'cache'),
  }
}

export function localPaths(cwd: string): LocalPaths {
  const configDir = join(cwd, '.guardrail')
  return {
    configDir,
    rulesDir: join(configDir, 'rules'),
  }
}
