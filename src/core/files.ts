import { existsSync, statSync } from 'node:fs'
import { globSync } from 'tinyglobby'
import { SUPPORTED_EXTENSIONS } from './language.js'

export function expandInputs(inputs: string[], ignorePatterns: string[]): string[] {
  const result: string[] = []
  for (const input of inputs) {
    if (existsSync(input)) {
      if (statSync(input).isDirectory()) {
        const pattern = `${input}/**/*.{${SUPPORTED_EXTENSIONS.join(',')}}`
        result.push(...globSync(pattern, { onlyFiles: true, ignore: ignorePatterns }))
      } else {
        const matches = globSync(input, { onlyFiles: true, ignore: ignorePatterns })
        if (matches.length > 0) result.push(...matches)
      }
    }
  }
  return result
}

export function getFileExtension(filename: string): string | null {
  const dot = filename.lastIndexOf('.')
  if (dot === -1) return null
  return filename.slice(dot + 1)
}
