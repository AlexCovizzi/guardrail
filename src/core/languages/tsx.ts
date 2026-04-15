import type { LanguageDefinition } from './index.js'
import { TYPESCRIPT } from './typescript.js'

export const TSX: LanguageDefinition = { ...TYPESCRIPT, name: 'tsx', extensions: ['tsx'] }
