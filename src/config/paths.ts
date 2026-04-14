import { join } from 'node:path'

export function globalPaths(home: string) {
  const configDir = join(home, '.guardrail')
  return {
    configDir,
    configPath: join(configDir, 'config.yaml'),
    rulesDir: join(configDir, 'rules'),
    cacheDir: join(configDir, 'cache'),
  }
}

export function localPaths(cwd: string) {
  const configDir = join(cwd, '.guardrail')
  return {
    configDir,
    rulesDir: join(configDir, 'rules'),
  }
}
