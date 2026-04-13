import { homedir } from 'node:os'
import { join } from 'node:path'

export const GLOBAL_CONFIG_DIR = join(homedir(), '.guardrail')
export const GLOBAL_CONFIG_PATH = join(GLOBAL_CONFIG_DIR, 'config.yaml')
export const GLOBAL_RULES_DIR = join(GLOBAL_CONFIG_DIR, 'rules')
