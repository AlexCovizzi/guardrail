import type { LanguageDefinition } from './index.js'
import { JAVASCRIPT } from './javascript.js'

export const TYPESCRIPT: LanguageDefinition = {
  ...JAVASCRIPT,
  name: 'typescript',
  extensions: ['ts'],
  kinds: {
    ...JAVASCRIPT.kinds,
    interface: [{ type: 'interface_declaration' }],
    type: [{ type: 'type_alias_declaration' }],
    enum: [{ type: 'enum_declaration' }],
    namespace: [{ type: 'internal_module' }, { type: 'ambient_declaration' }],
  },
}
