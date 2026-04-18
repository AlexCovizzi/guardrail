import { describe, expect, it } from 'vitest'
import { collectViolations, getBuiltinRule, matchesAnyNode } from '../../test/helpers.js'

describe('declaration-order examples', () => {
  // --- Rule metadata ---

  it('has correct description', () => {
    expect(getBuiltinRule('declaration-order').description).toBe(
      'Top-level declarations should be ordered consistently'
    )
  })

  it('uses correct default severity', () => {
    expect(getBuiltinRule('declaration-order').severity).toBe('error')
  })

  // --- JavaScript ---

  describe('javascript', () => {
    it('valid: correct default order — import, anything, export', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `import foo from 'foo'
const X = 1
let y = 2
function bar() {}
class Baz {}
export { bar }
`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('invalid: function before constant with strict order', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['constant', 'function'] })
      const code = `function bar() {}
const X = 1
`
      const violations = await collectViolations(rule, code, 'javascript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('constant should come before function')
    })

    it('invalid: class before function with strict order', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['function', 'class'] })
      const code = `class Baz {}
function bar() {}
`
      const violations = await collectViolations(rule, code, 'javascript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('function should come before class')
    })

    it('valid: exports at the end is valid with default order', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `import foo from 'foo'
const X = 1
function bar() {}
export { bar }
`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('invalid: declarations after export with default order', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `import foo from 'foo'
export { foo }
const X = 1
function bar() {}
`
      const violations = await collectViolations(rule, code, 'javascript')
      expect(violations.length).toBeGreaterThanOrEqual(1)
      expect(violations[0]).toContain('after export')
    })

    it('valid: var and const are in * zone with default order', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `const X = 1
var y = 2
function bar() {}
`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('invalid: let before const with strict order', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['constant', 'variable'] })
      const code = `let x = 1
const Y = 2
`
      const violations = await collectViolations(rule, code, 'javascript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('constant should come before variable')
    })

    it('valid: multiple imports group together', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `import foo from 'foo'
import bar from 'bar'
const X = 1
`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('valid: expression statements are skipped', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `import foo from 'foo'
console.log('hello')
const X = 1
function bar() {}
`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('valid: custom order — class first', async () => {
      const rule = getBuiltinRule('declaration-order', {
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
      const rule = getBuiltinRule('declaration-order', {
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
    it('valid: correct default order with TS-specific kinds in * zone', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `import foo from 'foo'
interface IFoo {}
type Alias = string
enum Dir { Up }
namespace NS {}
const X = 1
function bar() {}
class Baz {}
export { bar }
`
      expect(await collectViolations(rule, code, 'typescript')).toEqual([])
    })

    it('invalid: function before interface with strict order', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['interface', 'function'] })
      const code = `function bar() {}
interface IFoo {}
`
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('interface should come before function')
    })

    it('valid: exports at the end with default order', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `import foo from 'foo'
const X = 1
function bar() {}
class Baz {}
export { bar }
`
      expect(await collectViolations(rule, code, 'typescript')).toEqual([])
    })

    it('valid: TS namespace via expression_statement', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `import foo from 'foo'
namespace NS {}
const X = 1
`
      expect(await collectViolations(rule, code, 'typescript')).toEqual([])
    })

    it('valid: declare blocks classified as namespace', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `import foo from 'foo'
declare module 'bar' {}
const X = 1
`
      expect(await collectViolations(rule, code, 'typescript')).toEqual([])
    })
  })

  // --- Python ---

  describe('python', () => {
    it('valid: correct default order — imports first in Python', async () => {
      const rule = getBuiltinRule('declaration-order')
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

    it('invalid: function before import with default order', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `def foo():
    pass
import os
`
      const violations = await collectViolations(rule, code, 'python')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('before import')
    })

    it('invalid: class before function with strict order', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['function', 'class'] })
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
      const rule = getBuiltinRule('declaration-order')
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
    it('valid: correct default order — imports first in Java', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `import java.util.List;
interface Bar {}
enum Baz { A, B }
class Foo {}
`
      expect(await collectViolations(rule, code, 'java')).toEqual([])
    })

    it('invalid: class before import with default order', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `class Foo {}
import java.util.List;
`
      const violations = await collectViolations(rule, code, 'java')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('before import')
    })

    it('valid: annotation type classified as interface', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `import java.util.List;
@interface Ann {}
class Foo {}
`
      expect(await collectViolations(rule, code, 'java')).toEqual([])
    })

    it('valid: record classified as class', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `import java.util.List;
class Foo {}
record Rec(String name) {}
`
      expect(await collectViolations(rule, code, 'java')).toEqual([])
    })
  })

  // --- Kotlin ---

  describe('kotlin', () => {
    it('valid: correct default order — imports first in Kotlin', async () => {
      const rule = getBuiltinRule('declaration-order')
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

    it('invalid: function before constant with strict order', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['constant', 'function'] })
      const code = `fun foo() {}
const val X = 1
`
      const violations = await collectViolations(rule, code, 'kotlin')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('constant should come before function')
    })

    it('valid: interface classified correctly', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `import java.util.List
interface IBaz {}
class Bar {}
`
      expect(await collectViolations(rule, code, 'kotlin')).toEqual([])
    })

    it('valid: enum class classified correctly', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `import java.util.List
enum class Dir { UP, DOWN }
class Bar {}
`
      expect(await collectViolations(rule, code, 'kotlin')).toEqual([])
    })

    it('valid: object declaration classified as class', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `import java.util.List
object Obj {}
class Bar {}
`
      expect(await collectViolations(rule, code, 'kotlin')).toEqual([])
    })

    it('invalid: var property classed as variable with strict order', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['variable', 'function'] })
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
      const rule = getBuiltinRule('declaration-order')
      expect(await collectViolations(rule, '', 'javascript')).toEqual([])
    })

    it('valid: single declaration produces no violations', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `const X = 1`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('valid: same-rank declarations in any order produce no violations', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `const X = 1
const Y = 2
const Z = 3
`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('valid: matchesAnyNode returns false for correct order', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `import foo from 'foo'\nconst X = 1\nfunction bar() {}`
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(false)
    })

    it('valid: matchesAnyNode returns true for wrong order', async () => {
      const rule = getBuiltinRule('declaration-order')
      const code = `const X = 1\nimport foo from 'foo'`
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(true)
    })
  })

  // --- Wildcard order ---

  describe('wildcard order', () => {
    it('valid: leading wildcard — unlisted kinds before first listed kind are allowed', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['*', 'import'] })
      const code = `const X = 1
import foo from 'foo'
`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('valid: trailing wildcard — unlisted kinds after last listed kind are allowed', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['import', '*'] })
      const code = `import foo from 'foo'
const X = 1
function bar() {}
`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('invalid: no leading wildcard — unlisted kind before first listed kind', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['import', '*'] })
      const code = `const X = 1
import foo from 'foo'
`
      const violations = await collectViolations(rule, code, 'javascript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('before import')
    })

    it('valid: wildcard between listed kinds — unlisted kinds in the middle', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['import', '*', 'function'] })
      const code = `import foo from 'foo'
const X = 1
function bar() {}
`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('valid: no wildcard anywhere — unlisted kinds are invisible regardless of position', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['import', 'function'] })
      const code = `const X = 1
import foo from 'foo'
const Y = 2
function bar() {}
const Z = 3
`
      expect(await collectViolations(rule, code, 'javascript')).toHaveLength(0)
    })

    it('invalid: wildcard only allows unlisted kinds in its zone (leading gap)', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['import', '*', 'function'] })
      const code = `const X = 1
import foo from 'foo'
function bar() {}
`
      const violations = await collectViolations(rule, code, 'javascript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('before import')
    })

    it('invalid: wildcard only allows unlisted kinds in its zone (trailing gap)', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['import', '*', 'function'] })
      const code = `import foo from 'foo'
function bar() {}
const X = 1
`
      const violations = await collectViolations(rule, code, 'javascript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('no wildcard')
    })

    it('valid: imports first with trailing wildcard (most common use case)', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['import', '*'] })
      const code = `import foo from 'foo'
import bar from 'bar'
const X = 1
function baz() {}
class Qux {}
`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('valid: functions before classes with wildcards (unlisted kinds free)', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['*', 'function', 'class', '*'] })
      const code = `const X = 1
function bar() {}
class Baz {}
const Y = 2
`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('invalid: function after class violates listed order even with wildcards', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['*', 'function', 'class', '*'] })
      const code = `class Baz {}
function bar() {}
`
      const violations = await collectViolations(rule, code, 'javascript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('function should come before class')
    })

    it('valid: full order with wildcard in the middle', async () => {
      const rule = getBuiltinRule('declaration-order', {
        order: ['import', 'type', '*', 'function', 'class', 'export'],
      })
      const code = `import foo from 'foo'
type X = string
const Y = 1
function bar() {}
class Baz {}
export { bar }
`
      expect(await collectViolations(rule, code, 'typescript')).toEqual([])
    })

    it('valid: no wildcard — unlisted kinds are invisible (current behavior)', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['function', 'class'] })
      const code = `const X = 1
function bar() {}
class Baz {}
`
      expect(await collectViolations(rule, code, 'javascript')).toEqual([])
    })

    it('invalid: no wildcard — listed kinds still enforce ordering', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['function', 'class'] })
      const code = `class Baz {}
function bar() {}
`
      const violations = await collectViolations(rule, code, 'javascript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('function should come before class')
    })

    it('valid: unlisted kind in * zone between listed kinds', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['import', '*', 'function'] })
      const code = `import foo from 'foo'
const X = 1
function bar() {}
`
      expect(await collectViolations(rule, code, 'javascript')).toHaveLength(0)
    })

    // --- Absent listed kinds become inert ---

    it('valid: absent listed kinds are removed from effective order — [import, *, export] in Python', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['import', '*', 'export'] })
      const code = `import os
import sys

FOO = 1

def bar():
    pass

class Baz:
    pass
`
      expect(await collectViolations(rule, code, 'python')).toHaveLength(0)
    })

    it('valid: absent listed kinds are removed from effective order — [import, *, export] in Java', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['import', '*', 'export'] })
      const code = `import java.util.List;

public class Foo {
  public static void main(String[] args) {}
}
`
      expect(await collectViolations(rule, code, 'java')).toHaveLength(0)
    })

    it('valid: absent listed kinds are removed — JS file with no exports', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['import', '*', 'export'] })
      const code = `import foo from 'foo'
const X = 1
function bar() {}
`
      expect(await collectViolations(rule, code, 'javascript')).toHaveLength(0)
    })

    it('invalid: absent listed kind does not help when * is in wrong position', async () => {
      const rule = getBuiltinRule('declaration-order', { order: ['import', 'type', '*', 'function'] })
      const code = `import os

def bar():
    pass

FOO = 1
`
      const violations = await collectViolations(rule, code, 'python')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('no wildcard')
    })
  })
})
