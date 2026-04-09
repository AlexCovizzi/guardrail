import { Registry } from '../../core/types.js'
import registerFunctionLength from './function-length.js'
import registerFunctionComplexity from './function-complexity.js'
import registerFunctionParameterCount from './function-parameter-count.js'

export function registerBuiltins(registry: Registry): void {
  registerFunctionLength(registry)
  registerFunctionComplexity(registry)
  registerFunctionParameterCount(registry)
}