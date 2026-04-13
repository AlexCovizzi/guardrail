export interface ConfigData {
  extends?: string | string[]
  rules?: Record<string, Record<string, unknown>>
  overrides?: Record<string, { rules?: Record<string, Record<string, unknown>> }>
  ignore?: string[]
}
