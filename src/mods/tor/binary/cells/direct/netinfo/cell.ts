import { BinaryReadError, BinaryWriteError } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { Ok, Result } from "@hazae41/result";
import { TypedAddress } from "mods/tor/binary/address.js";

export class NetinfoCell {
  readonly #class = NetinfoCell

  static readonly circuit = false
  static readonly command = 8

  constructor(
    readonly time: number,
    readonly other: TypedAddress,
    readonly owneds: TypedAddress[]
  ) { }

  get command() {
    return this.#class.command
  }

  trySize(): Result<number, never> {
    return new Ok(0
      + 4
      + this.other.trySize().get()
      + 1
      + this.owneds.reduce((p, c) => p + c.trySize().get(), 0))
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return Result.unthrowSync(t => {
      cursor.tryWriteUint32(this.time)
      this.other.tryWrite(cursor)
      cursor.tryWriteUint8(this.owneds.length)

      for (const owned of this.owneds)
        owned.tryWrite(cursor)

      return Ok.void()
    })
  }

  static tryRead(cursor: Cursor): Result<NetinfoCell, BinaryReadError> {
    return Result.unthrowSync(t => {
      const time = cursor.tryReadUint32().throw(t)
      const other = TypedAddress.tryRead(cursor).throw(t)
      const owneds = new Array<TypedAddress>(cursor.tryReadUint8().throw(t))

      for (let i = 0; i < owneds.length; i++)
        owneds[i] = TypedAddress.tryRead(cursor).throw(t)

      cursor.offset += cursor.remaining

      return new Ok(new NetinfoCell(time, other, owneds))
    })
  }

}