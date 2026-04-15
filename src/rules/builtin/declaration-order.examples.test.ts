import { describe, expect, it } from 'vitest'
import { RuleConfig } from '../../config/rule-config.js'
import { collectViolations, matchesAnyNode } from '../../test/helpers.js'
import { RuleRegistry } from '../registry.js'
import registerDeclarationOrder from './declaration-order.js'

function getRule(config: Record<string, any> = {}) {
  const registry = new RuleRegistry()
  registerDeclarationOrder(registry.register.bind(registry))
  const [{ ruleId, definition }] = registry.getEntries()
  const builder = new RuleConfig(ruleId, config)
  return {
    description: definition.description,
    severity: 'error' as const,
    visitors: definition.create(builder),
  }
}

describe('declaration-order examples', () => {
  // --- Rule metadata ---

  it('has correct description', () => {
    expect(getRule().description).toBe('Top-level declarations should be ordered consistently')
  })

  it('uses correct severity', () => {
    expect(getRule().severity).toBe('error')
  })

  // --- JavaScript ---

  describe('javascript', () => {
    it('valid: correct default order — import, constant, variable, function, class', async () => {
      const rule = getRule()
      const code = `import foo from 'foo'
const X = 1
let y = 2
function bar() {}
class Baz {}
`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('invalid: function before constant', async () => {
      const rule = getRule()
      const code = `function bar() {}
const X = 1
`
      const violations = await collectViolations(rule, code, 'javascript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('constant should come before function')
    })

    it('invalid: class before function', async () => {
      const rule = getRule()
      const code = `class Baz {}
function bar() {}
`
      const violations = await collectViolations(rule, code, 'javascript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('function should come before class')
    })

    it('valid: exports classified as export kind', async () => {
      const rule = getRule()
      const code = `import foo from 'foo'
export const Y = 2
export function baz() {}
export class Quux {}
const X = 1
function bar() {}
class Qux {}
`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('valid: var classified as variable', async () => {
      const rule = getRule()
      const code = `const X = 1
var y = 2
function bar() {}
`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('invalid: let before const', async () => {
      const rule = getRule()
      const code = `let x = 1
const Y = 2
`
      const violations = await collectViolations(rule, code, 'javascript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('constant should come before variable')
    })

    it('valid: multiple imports group together', async () => {
      const rule = getRule()
      const code = `import foo from 'foo'
import bar from 'bar'
const X = 1
`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('valid: expression statements are skipped', async () => {
      const rule = getRule()
      const code = `import foo from 'foo'
console.log('hello')
const X = 1
function bar() {}
`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('valid: custom order — class first', async () => {
      const rule = getRule({
        order: [
          'class',
          'function',
          'variable',
          'constant',
          'import',
          'export',
          'interface',
          'type',
          'enum',
          'namespace',
        ],
      })
      const code = `class Baz {}
function bar() {}
const X = 1
`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('invalid: violates custom order', async () => {
      const rule = getRule({
        order: [
          'class',
          'function',
          'variable',
          'constant',
          'import',
          'export',
          'interface',
          'type',
          'enum',
          'namespace',
        ],
      })
      const code = `function bar() {}
class Baz {}
`
      const violations = await collectViolations(rule, code, 'javascript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('class should come before function')
    })
  })

  // --- TypeScript ---

  describe('typescript', () => {
    it('valid: correct order with TS-specific kinds', async () => {
      const rule = getRule()
      const code = `import foo from 'foo'
interface IFoo {}
type Alias = string
enum Dir { Up }
namespace NS {}
const X = 1
function bar() {}
class Baz {}
`
      expect(await collectViolations(rule, code, 'typescript')).toEqual([])
    })

    it('invalid: function before interface', async () => {
      const rule = getRule()
      const code = `function bar() {}
interface IFoo {}
`
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('interface should come before function')
    })

    it('valid: export statements classified as export kind', async () => {
      const rule = getRule()
      const code = `import foo from 'foo'
export const Y = 2
export function baz() {}
export class Qux {}
const X = 1
function bar() {}
class Baz {}
`
      expect(await collectViolations(rule, code, 'typescript')).toEqual([])
    })

    it('valid: TS namespace via expression_statement', async () => {
      const rule = getRule()
      const code = `import foo from 'foo'
namespace NS {}
const X = 1
`
      expect(await collectViolations(rule, code, 'typescript')).toEqual([])
    })

    it('valid: declare blocks classified as namespace', async () => {
      const rule = getRule()
      const code = `import foo from 'foo'
declare module 'bar' {}
const X = 1
`
      expect(await collectViolations(rule, code, 'typescript')).toEqual([])
    })
  })

  // --- Python ---

  describe('python', () => {
    it('valid: correct order — import, variable, function, class', async () => {
      const rule = getRule()
      const code = `import os
from typing import List
x = 1
def foo():
    pass
class Bar:
    pass
`
      expect(await collectViolations(rule, code, 'python')).toEqual([])
    })

    it('invalid: function before import', async () => {
      const rule = getRule()
      const code = `def foo():
    pass
import os
`
      const violations = await collectViolations(rule, code, 'python')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('import should come before function')
    })

    it('invalid: class before function', async () => {
      const rule = getRule()
      const code = `class Bar:
    pass
def foo():
    pass
`
      const violations = await collectViolations(rule, code, 'python')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('function should come before class')
    })

    it('valid: non-assignment expression statements are skipped', async () => {
      const rule = getRule()
      const code = `import os
print('hello')
x = 1
def foo():
    pass
`
      expect(await collectViolations(rule, code, 'python')).toEqual([])
    })
  })

  // --- Java ---

  describe('java', () => {
    it('valid: correct order — import, interface, enum, class', async () => {
      const rule = getRule()
      const code = `import java.util.List;
interface Bar {}
enum Baz { A, B }
class Foo {}
`
      expect(await collectViolations(rule, code, 'java')).toEqual([])
    })

    it('invalid: class before import', async () => {
      const rule = getRule()
      const code = `class Foo {}
import java.util.List;
`
      const violations = await collectViolations(rule, code, 'java')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('import should come before class')
    })

    it('valid: annotation type classified as interface', async () => {
      const rule = getRule()
      const code = `import java.util.List;
@interface Ann {}
class Foo {}
`
      expect(await collectViolations(rule, code, 'java')).toEqual([])
    })

    it('valid: record classified as class', async () => {
      const rule = getRule()
      const code = `import java.util.List;
class Foo {}
record Rec(String name) {}
`
      expect(await collectViolations(rule, code, 'java')).toEqual([])
    })
  })

  // --- Kotlin ---

  describe('kotlin', () => {
    it('valid: correct order — import, type, constant, variable, function, class', async () => {
      const rule = getRule()
      const code = `import java.util.List
typealias StringList = List<String>
const val X = 1
val y = 2
var z = 3
fun foo() {}
class Bar {}
`
      expect(await collectViolations(rule, code, 'kotlin')).toEqual([])
    })

    it('invalid: function before constant', async () => {
      const rule = getRule()
      const code = `fun foo() {}
const val X = 1
`
      const violations = await collectViolations(rule, code, 'kotlin')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('constant should come before function')
    })

    it('valid: interface classified correctly', async () => {
      const rule = getRule()
      const code = `import java.util.List
interface IBaz {}
class Bar {}
`
      expect(await collectViolations(rule, code, 'kotlin')).toEqual([])
    })

    it('valid: enum class classified correctly', async () => {
      const rule = getRule()
      const code = `import java.util.List
enum class Dir { UP, DOWN }
class Bar {}
`
      expect(await collectViolations(rule, code, 'kotlin')).toEqual([])
    })

    it('valid: object declaration classified as class', async () => {
      const rule = getRule()
      const code = `import java.util.List
object Obj {}
class Bar {}
`
      expect(await collectViolations(rule, code, 'kotlin')).toEqual([])
    })

    it('invalid: var property classed as variable', async () => {
      const rule = getRule()
      const code = `fun foo() {}
var x = 1
`
      const violations = await collectViolations(rule, code, 'kotlin')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('variable should come before function')
    })
  })

  // --- Edge cases ---

  describe('edge cases', () => {
    it('valid: empty file produces no violations', async () => {
      const rule = getRule()
      expect(await collectViolations(rule, '', 'javascript')).toEqual([])
    })

    it('valid: single declaration produces no violations', async () => {
      const rule = getRule()
      const code = `const X = 1`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('valid: same-rank declarations in any order produce no violations', async () => {
      const rule = getRule()
      const code = `const X = 1
const Y = 2
const Z = 3
`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('valid: matchesAnyNode returns false for correct order', async () => {
      const rule = getRule()
      const code = `import foo from 'foo'\nconst X = 1\nfunction bar() {}`
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(false)
    })

    it('valid: matchesAnyNode returns true for wrong order', async () => {
      const rule = getRule()
      const code = `const X = 1\nimport foo from 'foo'`
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(true)
    })
  })
})
