import {existsSync, readdirSync} from 'node:fs'
import {join} from 'node:path'
import envPaths from 'env-paths'
import {createJiti} from 'jiti'
import {RuleRegistry} from "./registry.js";

const jiti = createJiti(import.meta.url)
const RULE_EXTENSIONS = ['.ts', '.js', '.mjs']

async function discoverRulesInDir(registry: RuleRegistry, dir: string): Promise<void> {
  if (!existsSync(dir)) return

  const files = readdirSync(dir)
    .filter((f) => RULE_EXTENSIONS.some((ext) => f.endsWith(ext)))
    .sort()

  for (const file of files) {
    try {
      const mod = (await jiti.import(join(dir, file))) as any
      const register = mod.default ?? mod
      if (typeof register === 'function') register(registry)
    } catch (err) {
      console.error(`guardrail: failed to load rule ${file}: ${(err as Error).message}`)
    }
  }
}

export async function discoverRules(registry: RuleRegistry): Promise<void> {
  const globalDir = join(envPaths('guardrail', {suffix: ''}).config, 'rules')
  const localDir = join(process.cwd(), '.guardrail', 'rules')
  await discoverRulesInDir(registry, globalDir)
  await discoverRulesInDir(registry, localDir)
}
