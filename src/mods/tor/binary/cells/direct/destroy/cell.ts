import { BinaryReadError, BinaryWriteError } from "@hazae41/binary"
import { Cursor } from "@hazae41/cursor"
import { Ok, Result } from "@hazae41/result"

export class DestroyCell {
  readonly #class = DestroyCell

  static readonly circuit = true
  static readonly command = 4

  static readonly reasons = {
    NONE: 0,
    PROTOCOL: 1,
    INTERNAL: 2,
    REQUESTED: 3,
    HIBERNATING: 4,
    RESOURCELIMIT: 5,
    CONNECTFAILED: 6,
    OR_IDENTITY: 7,
    CHANNEL_CLOSED: 8,
    FINISHED: 9,
    TIMEOUT: 10,
    DESTROYED: 11,
    NOSUCHSERVICE: 12
  } as const

  constructor(
    readonly reason: number
  ) { }

  get command() {
    return this.#class.command
  }

  trySize(): Result<number, never> {
    return new Ok(1)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return cursor.tryWriteUint8(this.reason)
  }

  static tryRead(cursor: Cursor): Result<DestroyCell, BinaryReadError> {
    return Result.unthrowSync(t => {
      const code = cursor.tryReadUint8().throw(t)

      cursor.offset += cursor.remaining

      return new Ok(new DestroyCell(code))
    })
  }

}