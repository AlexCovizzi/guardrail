import type { RegisterFn } from '../rule.js'
import registerClassLength from './class-length.js'
import registerClassMaxMethods from './class-max-methods.js'
import registerFunctionComplexity from './function-complexity.js'
import registerFunctionLength from './function-length.js'
import registerFunctionParameterCount from './function-parameter-count.js'

export function registerBuiltins(register: RegisterFn): void {
  registerClassLength(register)
  registerClassMaxMethods(register)
  registerFunctionLength(register)
  registerFunctionComplexity(register)
  registerFunctionParameterCount(register)
}
