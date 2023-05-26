import { BinaryReadError, BinaryWriteError } from "@hazae41/binary"
import { Cursor } from "@hazae41/cursor"
import { Ok, Result } from "@hazae41/result"

export class PaddingNegociateCell {
  readonly #class = PaddingNegociateCell

  static readonly circuit = false
  static readonly command = 12

  static readonly versions = {
    ZERO: 0
  } as const

  static commands = {
    STOP: 1,
    START: 2
  } as const

  constructor(
    readonly version: number,
    readonly pcommand: number,
    readonly ito_low_ms: number,
    readonly ito_high_ms: number
  ) { }

  get command() {
    return this.#class.command
  }

  trySize(): Result<number, never> {
    return new Ok(1 + 1 + 2 + 2)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return Result.unthrowSync(t => {
      cursor.tryWriteUint8(this.version).throw(t)
      cursor.tryWriteUint8(this.pcommand).throw(t)
      cursor.tryWriteUint16(this.ito_low_ms).throw(t)
      cursor.tryWriteUint16(this.ito_high_ms).throw(t)

      return Ok.void()
    })
  }

  static tryRead(cursor: Cursor): Result<PaddingNegociateCell, BinaryReadError> {
    return Result.unthrowSync(t => {
      const version = cursor.tryReadUint8().throw(t)
      const pcommand = cursor.tryReadUint8().throw(t)
      const ito_low_ms = cursor.tryReadUint16().throw(t)
      const ito_high_ms = cursor.tryReadUint16().throw(t)

      cursor.offset += cursor.remaining

      return new Ok(new PaddingNegociateCell(version, pcommand, ito_low_ms, ito_high_ms))
    })
  }

}