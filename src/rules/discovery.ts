import { createJiti } from 'jiti'
import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { Registry } from '../core/types.js'

const jiti = createJiti(import.meta.url)
const RULE_EXTENSIONS = ['.ts', '.js', '.mjs']

export async function discoverRules(registry: Registry): Promise<void> {
  const rulesDir = join(process.cwd(), '.guardrail', 'rules')
  if (!existsSync(rulesDir)) return

  const files = readdirSync(rulesDir)
    .filter(f => RULE_EXTENSIONS.some(ext => f.endsWith(ext)))
    .sort()

  for (const file of files) {
    try {
      const mod = await jiti.import(join(rulesDir, file)) as any
      const register = mod.default ?? mod
      if (typeof register === 'function') register(registry)
    } catch (err) {
      console.error(`guardrail: failed to load rule ${file}: ${(err as Error).message}`)
    }
  }
}