import { ConfigSchema, FieldDef, RuleConfig, ResolvedConfig } from '../core/types.js'

const SEVERITY_VALUES = ['error', 'warning'] as const

export class ConfigValidationError extends Error {
  constructor(ruleId: string, message: string) {
    super(`Rule "${ruleId}": ${message}`)
    this.name = 'ConfigValidationError'
  }
}

function validateField(ruleId: string, key: string, field: FieldDef, raw: unknown): unknown {
  if (raw === undefined || raw === null) {
    if (field.default !== undefined) return field.default
    throw new ConfigValidationError(ruleId, `option "${key}" is required`)
  }

  switch (field.type) {
    case 'string': {
      if (typeof raw !== 'string')
        throw new ConfigValidationError(ruleId, `option "${key}" must be a string, got ${typeof raw}`)
      if (field.minLength !== undefined && raw.length < field.minLength)
        throw new ConfigValidationError(ruleId, `option "${key}" must have at least ${field.minLength} characters`)
      if (field.maxLength !== undefined && raw.length > field.maxLength)
        throw new ConfigValidationError(ruleId, `option "${key}" must have at most ${field.maxLength} characters`)
      return raw
    }
    case 'number': {
      if (typeof raw !== 'number')
        throw new ConfigValidationError(ruleId, `option "${key}" must be a number, got ${typeof raw}`)
      if (field.min !== undefined && raw < field.min)
        throw new ConfigValidationError(ruleId, `option "${key}" must be >= ${field.min}, got ${raw}`)
      if (field.max !== undefined && raw > field.max)
        throw new ConfigValidationError(ruleId, `option "${key}" must be <= ${field.max}, got ${raw}`)
      return raw
    }
    case 'boolean': {
      if (typeof raw !== 'boolean')
        throw new ConfigValidationError(ruleId, `option "${key}" must be a boolean, got ${typeof raw}`)
      return raw
    }
    case 'enum': {
      if (!(field.values as readonly unknown[]).includes(raw))
        throw new ConfigValidationError(
          ruleId,
          `option "${key}" must be one of ${field.values.map(v => `"${v}"`).join(', ')}, got "${raw}"`
        )
      return raw
    }
  }
}

export function validateConfig<S extends ConfigSchema>(
  ruleId: string,
  schema: S,
  raw: RuleConfig
): ResolvedConfig<S> {
  const resolved: Record<string, unknown> = {}

  const rawSeverity = raw.severity
  if (rawSeverity !== undefined) {
    if (!(SEVERITY_VALUES as readonly string[]).includes(rawSeverity))
      throw new ConfigValidationError(
        ruleId,
        `option "severity" must be one of ${SEVERITY_VALUES.map(v => `"${v}"`).join(', ')}, got "${rawSeverity}"`
      )
    resolved.severity = rawSeverity
  } else {
    resolved.severity = 'error'
  }

  for (const [key, field] of Object.entries(schema)) {
    resolved[key] = validateField(ruleId, key, field, raw[key])
  }

  return resolved as ResolvedConfig<S>
}