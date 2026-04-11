export class ConfigValidationError extends Error {
  constructor(ruleId: string, message: string) {
    super(`Rule "${ruleId}": ${message}`)
    this.name = 'ConfigValidationError'
  }
}

export class RuleConfig {
  constructor(
    private ruleId: string,
    private raw: Record<string, unknown>
  ) {}

  number(key: string, opts: { default: number; min?: number; max?: number }): number {
    const val = this.raw[key] ?? opts.default
    if (typeof val !== 'number' || !Number.isFinite(val))
      throw new ConfigValidationError(this.ruleId, `option "${key}" must be a number, got ${typeof val}`)
    if (opts.min !== undefined && val < opts.min)
      throw new ConfigValidationError(this.ruleId, `option "${key}" must be >= ${opts.min}, got ${val}`)
    if (opts.max !== undefined && val > opts.max)
      throw new ConfigValidationError(this.ruleId, `option "${key}" must be <= ${opts.max}, got ${val}`)
    return val
  }

  string(key: string, opts: { default: string; minLength?: number; maxLength?: number }): string {
    const val = this.raw[key] ?? opts.default
    if (typeof val !== 'string')
      throw new ConfigValidationError(this.ruleId, `option "${key}" must be a string, got ${typeof val}`)
    if (opts.minLength !== undefined && val.length < opts.minLength)
      throw new ConfigValidationError(this.ruleId, `option "${key}" must have at least ${opts.minLength} characters`)
    if (opts.maxLength !== undefined && val.length > opts.maxLength)
      throw new ConfigValidationError(this.ruleId, `option "${key}" must have at most ${opts.maxLength} characters`)
    return val
  }

  boolean(key: string, opts: { default: boolean }): boolean {
    const val = this.raw[key] ?? opts.default
    if (typeof val !== 'boolean')
      throw new ConfigValidationError(this.ruleId, `option "${key}" must be a boolean, got ${typeof val}`)
    return val
  }

  enum<T extends readonly (string | number)[]>(key: string, opts: { values: T; default: T[number] }): T[number] {
    const val = this.raw[key] ?? opts.default
    if (!(opts.values as readonly unknown[]).includes(val))
      throw new ConfigValidationError(
        this.ruleId,
        `option "${key}" must be one of ${opts.values.map((v) => `"${v}"`).join(', ')}, got "${val}"`
      )
    return val as T[number]
  }

  isEnabled(): boolean {
    if (this.raw.enabled !== undefined) return this.raw.enabled as boolean
    return !(this.raw.disabled as boolean)
  }

  getSeverity(defaultSeverity?: 'error' | 'warning'): 'error' | 'warning' {
    return (this.raw.severity as 'error' | 'warning' | undefined) ?? defaultSeverity ?? 'error'
  }
}
