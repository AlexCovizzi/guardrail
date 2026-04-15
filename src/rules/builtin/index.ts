import type { RegisterFn } from '../rule.js'
import registerClassMaxLines from './class-max-lines.js'
import registerClassMaxMethods from './class-max-methods.js'
import registerClassMemberOrdering from './class-member-ordering.js'
import registerDeclarationOrder from './declaration-order.js'
import registerFunctionMaxComplexity from './function-max-complexity.js'
import registerFunctionMaxLines from './function-max-lines.js'
import registerFunctionMaxNesting from './function-max-nesting.js'
import registerFunctionMaxParams from './function-max-params.js'

export function registerBuiltins(register: RegisterFn): void {
  registerClassMaxLines(register)
  registerClassMaxMethods(register)
  registerClassMemberOrdering(register)
  registerDeclarationOrder(register)
  registerFunctionMaxLines(register)
  registerFunctionMaxComplexity(register)
  registerFunctionMaxNesting(register)
  registerFunctionMaxParams(register)
}
