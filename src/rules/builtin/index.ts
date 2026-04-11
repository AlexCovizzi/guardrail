import type { Registry } from '../rule.js'
import registerClassLength from './class-length.js'
import registerClassMaxMethods from './class-max-methods.js'
import registerFunctionComplexity from './function-complexity.js'
import registerFunctionLength from './function-length.js'
import registerFunctionParameterCount from './function-parameter-count.js'

export function registerBuiltins(registry: Registry): void {
  registerClassLength(registry)
  registerClassMaxMethods(registry)
  registerFunctionLength(registry)
  registerFunctionComplexity(registry)
  registerFunctionParameterCount(registry)
}
