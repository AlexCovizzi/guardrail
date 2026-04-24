import type * as TreeSitter from 'web-tree-sitter'
import type { LanguageDefinition } from './language.js'
import type { NodePattern, SemanticKind } from './languages/types.js'
import { Tree } from './tree.js'
import { TreeCursor } from './tree-cursor.js'

type Point = TreeSitter.Point
type Edit = TreeSitter.Edit

/**
 * Wrapper around tree-sitter Node
 * Should only be used for externally facing interfaces (e.g. for the rule API)
 */
export class Node {
  constructor(
    private readonly internal: TreeSitter.Node,
    private readonly lang: LanguageDefinition
  ) {}

  /** Unwrap to the underlying tree-sitter Node. */
  unwrap(): TreeSitter.Node {
    return this.internal
  }

  is(kind: SemanticKind): boolean {
    const patterns = this.lang.kinds?.[kind]
    if (!patterns) return false
    for (const pattern of patterns) {
      if (this.matchesPattern(pattern)) return true
    }
    return false
  }

  kinds(): SemanticKind[] {
    const result: SemanticKind[] = []
    if (!this.lang.kinds) return result
    for (const kind of Object.keys(this.lang.kinds) as SemanticKind[]) {
      if (this.is(kind)) result.push(kind)
    }
    return result
  }

  /**
   * Test whether this node matches a NodePattern (type + optional constraints).
   * Used by the dispatch engine to enforce hasChild/lacksChild constraints.
   */
  matchesPattern(pattern: NodePattern): boolean {
    if (this.type !== pattern.type) return false
    if (pattern.hasChild) {
      const required = Array.isArray(pattern.hasChild) ? pattern.hasChild : [pattern.hasChild]
      for (const childType of required) {
        if (!this.hasChildType(childType)) return false
      }
    }
    if (pattern.lacksChild) {
      const forbidden = Array.isArray(pattern.lacksChild) ? pattern.lacksChild : [pattern.lacksChild]
      for (const childType of forbidden) {
        if (this.hasChildType(childType)) return false
      }
    }
    if (pattern.notText) {
      if (this.text === pattern.notText) return false
    }
    return true
  }

  private hasChildType(childType: string): boolean {
    for (let i = 0; i < this.internal.childCount; i++) {
      if (this.internal.child(i)?.type === childType) return true
    }
    return false
  }

  private wrap(node: TreeSitter.Node | null): Node | null {
    return node ? new Node(node, this.lang) : null
  }

  private wrapAll(nodes: TreeSitter.Node[]): Node[] {
    return nodes.map((n) => new Node(n, this.lang))
  }

  get id(): number {
    return this.internal.id
  }
  get startIndex(): number {
    return this.internal.startIndex
  }
  get startPosition(): Point {
    return this.internal.startPosition
  }
  get typeId(): number {
    return this.internal.typeId
  }
  get grammarId(): number {
    return this.internal.grammarId
  }
  get type(): string {
    return this.internal.type
  }
  get grammarType(): string {
    return this.internal.grammarType
  }
  get isNamed(): boolean {
    return this.internal.isNamed
  }
  get isExtra(): boolean {
    return this.internal.isExtra
  }
  get isError(): boolean {
    return this.internal.isError
  }
  get isMissing(): boolean {
    return this.internal.isMissing
  }
  get hasChanges(): boolean {
    return this.internal.hasChanges
  }
  get hasError(): boolean {
    return this.internal.hasError
  }
  get endIndex(): number {
    return this.internal.endIndex
  }
  get endPosition(): Point {
    return this.internal.endPosition
  }
  get text(): string {
    return this.internal.text
  }
  get parseState(): number {
    return this.internal.parseState
  }
  get nextParseState(): number {
    return this.internal.nextParseState
  }
  get childCount(): number {
    return this.internal.childCount
  }
  get namedChildCount(): number {
    return this.internal.namedChildCount
  }
  get descendantCount(): number {
    return this.internal.descendantCount
  }

  get tree(): Tree {
    return new Tree(this.internal.tree, this.lang)
  }
  get parent(): Node | null {
    return this.wrap(this.internal.parent)
  }
  get firstChild(): Node | null {
    return this.wrap(this.internal.firstChild)
  }
  get firstNamedChild(): Node | null {
    return this.wrap(this.internal.firstNamedChild)
  }
  get lastChild(): Node | null {
    return this.wrap(this.internal.lastChild)
  }
  get lastNamedChild(): Node | null {
    return this.wrap(this.internal.lastNamedChild)
  }
  get children(): Node[] {
    return this.wrapAll(this.internal.children)
  }
  get namedChildren(): Node[] {
    return this.wrapAll(this.internal.namedChildren)
  }
  get nextSibling(): Node | null {
    return this.wrap(this.internal.nextSibling)
  }
  get previousSibling(): Node | null {
    return this.wrap(this.internal.previousSibling)
  }
  get nextNamedSibling(): Node | null {
    return this.wrap(this.internal.nextNamedSibling)
  }
  get previousNamedSibling(): Node | null {
    return this.wrap(this.internal.previousNamedSibling)
  }

  fieldNameForChild(index: number): string | null {
    return this.internal.fieldNameForChild(index)
  }
  fieldNameForNamedChild(index: number): string | null {
    return this.internal.fieldNameForNamedChild(index)
  }
  toString(): string {
    return this.internal.toString()
  }
  edit(edit: Edit): void {
    this.internal.edit(edit)
  }

  equals(other: Node): boolean {
    return this.internal.equals(other.internal)
  }
  child(index: number): Node | null {
    return this.wrap(this.internal.child(index))
  }
  namedChild(index: number): Node | null {
    return this.wrap(this.internal.namedChild(index))
  }
  childForFieldId(fieldId: number): Node | null {
    return this.wrap(this.internal.childForFieldId(fieldId))
  }
  childForFieldName(fieldName: string): Node | null {
    return this.wrap(this.internal.childForFieldName(fieldName))
  }
  childrenForFieldName(fieldName: string): Node[] {
    return this.wrapAll(this.internal.childrenForFieldName(fieldName))
  }
  childrenForFieldId(fieldId: number): Node[] {
    return this.wrapAll(this.internal.childrenForFieldId(fieldId))
  }
  firstChildForIndex(index: number): Node | null {
    return this.wrap(this.internal.firstChildForIndex(index))
  }
  firstNamedChildForIndex(index: number): Node | null {
    return this.wrap(this.internal.firstNamedChildForIndex(index))
  }
  descendantsOfType(types: string | string[], startPosition?: Point, endPosition?: Point): Node[] {
    return this.wrapAll(this.internal.descendantsOfType(types, startPosition, endPosition))
  }
  childWithDescendant(descendant: Node): Node | null {
    return this.wrap(this.internal.childWithDescendant(descendant.internal))
  }
  descendantForIndex(start: number, end?: number): Node | null {
    return this.wrap(this.internal.descendantForIndex(start, end))
  }
  namedDescendantForIndex(start: number, end?: number): Node | null {
    return this.wrap(this.internal.namedDescendantForIndex(start, end))
  }
  descendantForPosition(start: Point, end?: Point): Node | null {
    return this.wrap(this.internal.descendantForPosition(start, end))
  }
  namedDescendantForPosition(start: Point, end?: Point): Node | null {
    return this.wrap(this.internal.namedDescendantForPosition(start, end))
  }
  walk(): TreeCursor {
    return new TreeCursor(this.internal.walk(), this.lang)
  }
}
