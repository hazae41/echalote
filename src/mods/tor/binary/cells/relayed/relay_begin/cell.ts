import { BinaryReadError, BinaryWriteError } from "@hazae41/binary"
import { Cursor } from "@hazae41/cursor"
import { Ok, Result } from "@hazae41/result"

export class RelayBeginCell {
  readonly #class = RelayBeginCell

  static readonly early = false
  static readonly stream = true
  static readonly rcommand = 1

  static flags = {
    IPV6_OK: 0,
    IPV4_NOT_OK: 1,
    IPV6_PREFER: 2
  }

  constructor(
    readonly address: string,
    readonly flags: number
  ) { }

  get early(): false {
    return this.#class.early
  }

  get stream(): true {
    return this.#class.stream
  }

  get rcommand() {
    return this.#class.rcommand
  }

  trySize(): Result<number, never> {
    return new Ok((this.address.length + 1) + 4)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return Result.unthrowSync(t => {
      cursor.tryWriteNulledString(this.address).throw(t)
      cursor.tryWriteUint32(this.flags).throw(t)

      return Ok.void()
    })
  }

  static tryRead(cursor: Cursor): Result<RelayBeginCell, BinaryReadError> {
    return Result.unthrowSync(t => {
      const address = cursor.tryReadNulledString().throw(t)
      const flags = cursor.tryReadUint32().throw(t)

      return new Ok(new RelayBeginCell(address, flags))
    })
  }

}