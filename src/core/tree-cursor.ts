import type * as TreeSitter from 'web-tree-sitter'
import type { LanguageDefinition } from './language.js'
import { Node } from './node.js'

type Point = TreeSitter.Point

/**
 * Wrapper around tree-sitter TreeCursor
 * Should only be used for externally facing interfaces (e.g. for the rule API)
 */
export class TreeCursor {
  constructor(
    private readonly internal: TreeSitter.TreeCursor,
    private readonly lang: LanguageDefinition
  ) {}

  get currentFieldId(): number {
    return this.internal.currentFieldId
  }
  get currentFieldName(): string | null {
    return this.internal.currentFieldName
  }
  get currentDepth(): number {
    return this.internal.currentDepth
  }
  get currentDescendantIndex(): number {
    return this.internal.currentDescendantIndex
  }
  get nodeType(): string {
    return this.internal.nodeType
  }
  get nodeTypeId(): number {
    return this.internal.nodeTypeId
  }
  get nodeStateId(): number {
    return this.internal.nodeStateId
  }
  get nodeId(): number {
    return this.internal.nodeId
  }
  get nodeIsNamed(): boolean {
    return this.internal.nodeIsNamed
  }
  get nodeIsMissing(): boolean {
    return this.internal.nodeIsMissing
  }
  get nodeText(): string {
    return this.internal.nodeText
  }
  get startPosition(): Point {
    return this.internal.startPosition
  }
  get endPosition(): Point {
    return this.internal.endPosition
  }
  get startIndex(): number {
    return this.internal.startIndex
  }
  get endIndex(): number {
    return this.internal.endIndex
  }

  get currentNode(): Node {
    return new Node(this.internal.currentNode, this.lang)
  }

  gotoFirstChild(): boolean {
    return this.internal.gotoFirstChild()
  }
  gotoLastChild(): boolean {
    return this.internal.gotoLastChild()
  }
  gotoParent(): boolean {
    return this.internal.gotoParent()
  }
  gotoNextSibling(): boolean {
    return this.internal.gotoNextSibling()
  }
  gotoPreviousSibling(): boolean {
    return this.internal.gotoPreviousSibling()
  }
  gotoDescendant(goalDescendantIndex: number): void {
    this.internal.gotoDescendant(goalDescendantIndex)
  }
  gotoFirstChildForIndex(goalIndex: number): boolean {
    return this.internal.gotoFirstChildForIndex(goalIndex)
  }
  gotoFirstChildForPosition(goalPosition: Point): boolean {
    return this.internal.gotoFirstChildForPosition(goalPosition)
  }
  delete(): void {
    this.internal.delete()
  }

  copy(): TreeCursor {
    return new TreeCursor(this.internal.copy(), this.lang)
  }
  reset(node: Node): void {
    this.internal.reset(node.unwrap())
  }
  resetTo(cursor: TreeCursor): void {
    this.internal.resetTo(cursor.internal)
  }
}
