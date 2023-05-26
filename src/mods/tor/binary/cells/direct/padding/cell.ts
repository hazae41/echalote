import { BinaryReadError } from "@hazae41/binary"
import { Cursor } from "@hazae41/cursor"
import { Panic, Result, Unimplemented } from "@hazae41/result"

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

  trySize(): Result<never, never> {
    throw Panic.from(new Unimplemented())
  }

  tryWrite(cursor: Cursor): Result<never, never> {
    throw Panic.from(new Unimplemented())
  }

  static tryRead(cursor: Cursor): Result<PaddingCell, BinaryReadError> {
    return cursor.tryRead(cursor.remaining).mapSync(x => new PaddingCell(x))
  }

}