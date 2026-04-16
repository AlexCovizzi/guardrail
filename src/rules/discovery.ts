import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createJiti } from 'jiti'
import type { Env } from '../core/env.js'
import type { RegisterFn } from './rule.js'

const jiti = createJiti(import.meta.url)
const RULE_EXTENSIONS = ['.ts', '.js', '.mjs']

async function discoverRulesInDir(register: RegisterFn, dir: string): Promise<void> {
  if (!existsSync(dir)) return

  const files = readdirSync(dir)
    .filter((f) => RULE_EXTENSIONS.some((ext) => f.endsWith(ext)))
    .sort()

  for (const file of files) {
    const filePath = join(dir, file)
    try {
      const mod = (await jiti.import(filePath)) as any
      const fn = mod.default ?? mod
      if (typeof fn !== 'function') {
        process.stderr.write(`guardrail: ${file}: expected a register function, got ${typeof fn}\n`)
        continue
      }
      fn(register)
    } catch (err) {
      process.stderr.write(`guardrail: failed to load rule ${file}: ${(err as Error).message}\n`)
    }
  }
}

export async function discoverRules(env: Env, register: RegisterFn): Promise<void> {
  await discoverRulesInDir(register, env.paths.global.rulesDir)
  await discoverRulesInDir(register, env.paths.local.rulesDir)
}
