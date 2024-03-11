import { Cursor } from "@hazae41/cursor"
import { Unimplemented } from "mods/tor/errors.js"

export class PaddingCell {
  readonly #class = PaddingCell

  static readonly circuit = false
  static readonly command = 0

  constructor(
    readonly data: Uint8Array
  ) { }

  get command() {
    return this.#class.command
  }

  sizeOrThrow(): never {
    throw new Unimplemented()
  }

  writeOrThrow(cursor: Cursor): never {
    throw new Unimplemented()
  }

  static readOrThrow(cursor: Cursor) {
    return new PaddingCell(cursor.readAndCopyOrThrow(cursor.remaining))
  }

}