import { BinaryReadError } from "@hazae41/binary"
import { Cursor } from "@hazae41/cursor"
import { Result } from "@hazae41/result"

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

  static tryRead(cursor: Cursor): Result<PaddingCell, BinaryReadError> {
    return cursor.tryRead(cursor.remaining).mapSync(x => new PaddingCell(x))
  }

}