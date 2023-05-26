import { BinaryReadError, BinaryWriteError } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { Ok, Result } from "@hazae41/result";

export class Create2Cell {
  readonly #class = Create2Cell

  static readonly circuit = true
  static readonly command = 10

  static readonly types = {
    /**
     * The old, slow, and insecure handshake
     * @deprecated
     */
    TAP: 0,
    /**
     * The new, quick, and secure handshake
     */
    NTOR: 2
  } as const

  constructor(
    readonly type: number,
    readonly data: Uint8Array
  ) { }

  get command() {
    return this.#class.command
  }

  trySize(): Result<number, never> {
    return new Ok(2 + 2 + this.data.length)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return Result.unthrowSync(t => {
      cursor.tryWriteUint16(this.type).throw(t)
      cursor.tryWriteUint16(this.data.length).throw(t)
      cursor.tryWrite(this.data).throw(t)

      return Ok.void()
    })
  }

  static tryRead(cursor: Cursor): Result<Create2Cell, BinaryReadError> {
    return Result.unthrowSync(t => {
      const type = cursor.tryReadUint16().throw(t)
      const length = cursor.tryReadUint16().throw(t)
      const data = cursor.tryRead(length).throw(t)

      cursor.offset += cursor.remaining

      return new Ok(new Create2Cell(type, data))
    })
  }

}