import type { RegisterFn } from '../rule.js'
import registerClassMaxFields from './class-max-fields.js'
import registerClassMaxLines from './class-max-lines.js'
import registerClassMaxMethods from './class-max-methods.js'
import registerClassMemberOrdering from './class-member-ordering.js'
import registerFunctionMaxComplexity from './function-max-complexity.js'
import registerFunctionMaxLines from './function-max-lines.js'
import registerFunctionMaxLocals from './function-max-locals.js'
import registerFunctionMaxNesting from './function-max-nesting.js'
import registerFunctionMaxParams from './function-max-params.js'
import registerFunctionMaxReturns from './function-max-returns.js'
import registerMaxFileLines from './max-file-lines.js'
import registerMaxImportLines from './max-import-lines.js'
import registerNoDuplicateImports from './no-duplicate-imports.js'
import registerNoMagicNumbers from './no-magic-numbers.js'
import registerNoShortNames from './no-short-names.js'

export function registerBuiltins(register: RegisterFn): void {
  registerClassMaxFields(register)
  registerClassMaxLines(register)
  registerClassMaxMethods(register)
  registerClassMemberOrdering(register)
  registerFunctionMaxLines(register)
  registerFunctionMaxComplexity(register)
  registerFunctionMaxLocals(register)
  registerFunctionMaxNesting(register)
  registerFunctionMaxParams(register)
  registerFunctionMaxReturns(register)
  registerMaxFileLines(register)
  registerMaxImportLines(register)
  registerNoDuplicateImports(register)
  registerNoMagicNumbers(register)
  registerNoShortNames(register)
}
