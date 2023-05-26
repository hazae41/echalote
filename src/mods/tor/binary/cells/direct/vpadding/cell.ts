import { BinaryReadError, BinaryWriteError } from "@hazae41/binary"
import { Cursor } from "@hazae41/cursor"
import { Ok, Result } from "@hazae41/result"

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

  trySize(): Result<number, never> {
    return new Ok(this.data.length)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return cursor.tryWrite(this.data)
  }

  static tryRead(cursor: Cursor): Result<VariablePaddingCell, BinaryReadError> {
    return cursor.tryRead(cursor.remaining).mapSync(x => new VariablePaddingCell(x))
  }

}