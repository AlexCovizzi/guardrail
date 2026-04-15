import type { LanguageDefinition } from './index.js'
import { JAVASCRIPT } from './javascript.js'

export const JSX: LanguageDefinition = { ...JAVASCRIPT, name: 'jsx', extensions: ['jsx'] }
