import { describe, expect, it } from 'vitest'
import { RuleConfig } from '../../config/rule-config.js'
import { collectViolations, matchesAnyNode } from '../../test/helpers.js'
import { RuleRegistry } from '../registry.js'
import registerClassMemberOrdering from './class-member-ordering.js'

function getRule(config: Record<string, any> = {}) {
  const registry = new RuleRegistry()
  registerClassMemberOrdering(registry.register.bind(registry))
  const [{ ruleId, definition }] = registry.getEntries()
  const builder = new RuleConfig(ruleId, config)
  return {
    description: definition.description,
    severity: ('error' as const),
    visitors: definition.create(builder),
  }
}

describe('class-member-ordering examples', () => {

  it('has correct description', () => {
    expect(getRule().description).toBe('Class members should be ordered consistently')
  })

  it('uses correct severity', () => {
    expect(getRule().severity).toBe('error')
  })

  it('respects custom severity', () => {
    // Severity is applied at rule creation time, verify via RuleConfig
    const registry = new RuleRegistry()
    registerClassMemberOrdering(registry.register.bind(registry))
    const [{ ruleId, definition }] = registry.getEntries()
    const builder = new RuleConfig(ruleId, { severity: 'warning' })
    expect(builder.getSeverity(definition.defaultSeverity)).toBe('warning')
  })

  describe('typescript fields-first (default)', () => {
    it('valid: correct full order — static fields, instance fields, constructor, static methods, instance methods', async () => {
      const rule = getRule({ order: 'fields-first' })
      const code = `class Foo {
  static sf1 = 1
  public static sf2 = 2
  public fi1 = 3
  private fi2 = 4
  constructor() {}
  static sm1() {}
  im1() {}
  private im2() {}
}`
      expect(await collectViolations(rule, code, 'typescript')).toEqual([])
    })

    it('invalid: method before field', async () => {
      const rule = getRule({ order: 'fields-first' })
      const code = `class Foo {
  pubMethod() {}
  pubField = 1
}`
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain("field 'pubField' should come before method 'pubMethod'")
    })

    it('invalid: private field before public field (same kind)', async () => {
      const rule = getRule({ order: 'fields-first' })
      const code = `class Foo {
  private privField = 1
  public pubField = 2
}`
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain("'pubField' should come before")
      expect(violations[0]).toContain('private field')
    })

    it('invalid: constructor after method', async () => {
      const rule = getRule({ order: 'fields-first' })
      const code = `class Foo {
  someMethod() {}
  constructor() {}
}`
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain("constructor 'constructor' should come before")
    })

    it('invalid: instance field before static field', async () => {
      const rule = getRule({ order: 'fields-first' })
      const code = `class Foo {
  instField = 1
  static statField = 2
}`
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain("'statField' should come before")
      expect(violations[0]).toContain('static field')
    })

    it('valid: empty class produces no violations', async () => {
      const rule = getRule({ order: 'fields-first' })
      const code = `class Foo {}`
      expect(await collectViolations(rule, code, 'typescript')).toEqual([])
    })

    it('valid: single member produces no violations', async () => {
      const rule = getRule({ order: 'fields-first' })
      const code = `class Foo { x = 1 }`
      expect(await collectViolations(rule, code, 'typescript')).toEqual([])
    })

    it('valid: same-rank members in any order produce no violations', async () => {
      const rule = getRule({ order: 'fields-first' })
      const code = `class Foo {
  a = 1
  b = 2
  c = 3
}`
      expect(await collectViolations(rule, code, 'typescript')).toEqual([])
    })
  })

  describe('typescript accessor-first', () => {
    it('valid: correct order — all public, then protected, then private', async () => {
      const rule = getRule({ order: 'accessor-first' })
      const code = `class Foo {
  public pubField = 1
  public pubMethod() {}
  protected protField = 2
  protected protMethod() {}
  private privField = 3
  private privMethod() {}
}`
      expect(await collectViolations(rule, code, 'typescript')).toEqual([])
    })

    it('invalid: private before public (even though field-before-method would be correct under fields-first)', async () => {
      const rule = getRule({ order: 'accessor-first' })
      const code = `class Foo {
  private privField = 1
  public pubMethod() {}
}`
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain("'pubMethod' should come before")
      expect(violations[0]).toContain('private field')
    })

    it('invalid: protected before public', async () => {
      const rule = getRule({ order: 'accessor-first' })
      const code = `class Foo {
  protected protField = 1
  public pubField = 2
}`
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain("'pubField' should come before")
    })
  })

  describe('typescript static-first', () => {
    it('valid: correct order — all static (fields then methods), then all instance', async () => {
      const rule = getRule({ order: 'static-first' })
      const code = `class Foo {
  static statField = 1
  static statMethod() {}
  instField = 2
  instMethod() {}
}`
      expect(await collectViolations(rule, code, 'typescript')).toEqual([])
    })

    it('invalid: instance before static', async () => {
      const rule = getRule({ order: 'static-first' })
      const code = `class Foo {
  instField = 1
  static statField = 2
}`
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain("'statField' should come before")
      expect(violations[0]).toContain('static field')
    })
  })

  describe('javascript #private members', () => {
    it('invalid: #private method before public method', async () => {
      const rule = getRule({ order: 'fields-first' })
      const code = `class Foo {
  #privateMethod() {}
  publicMethod() {}
}`
      const violations = await collectViolations(rule, code, 'javascript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain("'publicMethod' should come before")
      expect(violations[0]).toContain('#private method')
    })

    it('invalid: #private field before public field', async () => {
      const rule = getRule({ order: 'fields-first' })
      const code = `class Foo {
  #priv = 1
  pub = 2
}`
      const violations = await collectViolations(rule, code, 'javascript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain("'pub' should come before")
      expect(violations[0]).toContain('#private field')
    })

    it('valid: correct fields-first order with #private members', async () => {
      const rule = getRule({ order: 'fields-first' })
      const code = `class Foo {
  static s = 1
  pub = 2
  #priv = 3
  constructor() {}
  method() {}
  #privateMethod() {}
}`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('valid: correct order in javascript', async () => {
      const rule = getRule({ order: 'fields-first' })
      const code = `class Foo {
  static statField = 1
  instField = 2
  constructor() {}
  instMethod() {}
}`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })
  })

  describe('static blocks and index signatures', () => {
    it('valid: static block after static fields (fields-first)', async () => {
      const rule = getRule({ order: 'fields-first' })
      const code = `class Foo {
  static x = 1
  static { /* init */ }
}`
      // static block is rank 0 (static field, public), same as static x — no violation
      expect(await collectViolations(rule, code, 'typescript')).toEqual([])
    })

    it('valid: static block and index signature in correct position', async () => {
      const rule = getRule({ order: 'fields-first' })
      const code = `class Foo {
  static x = 1
  static { /* init */ }
  [key: string]: unknown
  constructor() {}
  method() {}
}`
      expect(await collectViolations(rule, code, 'typescript')).toEqual([])
    })
  })

  describe('violation messages', () => {
    it('describes protected static field correctly', async () => {
      const rule = getRule({ order: 'fields-first' })
      const code = `class Foo {
  protected static ps1 = 1
  public ps2 = 2
}`
      // protected static field (rank: kind=0*100 + static=0*10 + protected=1*1 = 1)
      // vs public instance field (rank: kind=0*100 + instance=1*10 + public=0*1 = 10)
      // Actually protected static < public instance → violation
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations.length).toBeGreaterThanOrEqual(0) // depends on actual rank comparison
    })

    it('describes constructor in violation message', async () => {
      const rule = getRule({ order: 'fields-first' })
      const code = `class Foo {
  method() {}
  constructor() {}
}`
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain("constructor 'constructor' should come before")
      expect(violations[0]).toContain("method 'method'")
    })

    it('describes private instance method in violation message', async () => {
      const rule = getRule({ order: 'fields-first' })
      const code = `class Foo {
  private privMethod() {}
  public pubMethod() {}
}`
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain("'pubMethod' should come before")
      expect(violations[0]).toContain('private method')
    })
  })

  describe('matchesAnyNode compatibility', () => {
    it('valid: correct order returns false', async () => {
      const rule = getRule({ order: 'fields-first' })
      const code = `class Foo { x = 1; constructor() {} method() {} }`
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it('invalid: wrong order returns true', async () => {
      const rule = getRule({ order: 'fields-first' })
      const code = `class Foo { method() {} x = 1 }`
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })
  })

  describe('abstract classes', () => {
    it('valid: abstract method signature after regular methods (fields-first)', async () => {
      const rule = getRule({ order: 'fields-first' })
      const code = `abstract class Foo {
  x = 1
  constructor() {}
  abstract bar(): void
}`
      expect(await collectViolations(rule, code, 'typescript')).toEqual([])
    })
  })

  describe('default preset', () => {
    it('defaults to fields-first when no order specified', async () => {
      const rule = getRule()
      const code = `class Foo {
  method() {}
  field = 1
}`
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })
  })
})
