import { Cursor } from "@hazae41/cursor"

export class VariablePaddingCell {
  readonly #class = VariablePaddingCell

  static readonly circuit = false
  static readonly command = 128

  constructor(
    readonly data: Uint8Array
  ) { }

  get command() {
    return this.#class.command
  }

  sizeOrThrow() {
    return this.data.length
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeOrThrow(this.data)
  }

  static readOrThrow(cursor: Cursor) {
    return new VariablePaddingCell(cursor.readAndCopyOrThrow(cursor.remaining))
  }

}