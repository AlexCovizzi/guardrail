import type * as TreeSitter from 'web-tree-sitter'
import type { LanguageDefinition } from './language.js'
import { Node } from './node.js'
import { TreeCursor } from './tree-cursor.js'

type Point = TreeSitter.Point
type Range = TreeSitter.Range
type Edit = TreeSitter.Edit

/**
 * Wrapper around tree-sitter Tree
 * Should only be used for externally facing interfaces (e.g. for the rule API)
 */
export class Tree {
  constructor(
    private readonly internal: TreeSitter.Tree,
    private readonly lang: LanguageDefinition
  ) {}

  unwrap(): TreeSitter.Tree {
    return this.internal
  }

  get language(): TreeSitter.Language {
    return this.internal.language
  }

  get rootNode(): Node {
    return new Node(this.internal.rootNode, this.lang)
  }

  delete(): void {
    this.internal.delete()
  }
  edit(edit: Edit): void {
    this.internal.edit(edit)
  }
  getIncludedRanges(): Range[] {
    return this.internal.getIncludedRanges()
  }

  copy(): Tree {
    return new Tree(this.internal.copy(), this.lang)
  }
  rootNodeWithOffset(offsetBytes: number, offsetExtent: Point): Node {
    return new Node(this.internal.rootNodeWithOffset(offsetBytes, offsetExtent), this.lang)
  }
  walk(): TreeCursor {
    return new TreeCursor(this.internal.walk(), this.lang)
  }
  getChangedRanges(other: Tree): Range[] {
    return this.internal.getChangedRanges(other.unwrap())
  }
}
