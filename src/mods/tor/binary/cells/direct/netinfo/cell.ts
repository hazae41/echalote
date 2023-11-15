import { Cursor } from "@hazae41/cursor";
import { TypedAddress } from "mods/tor/binary/address.js";

export class NetinfoCell {
  readonly #class = NetinfoCell

  static readonly old = false
  static readonly circuit = false
  static readonly command = 8

  constructor(
    readonly time: number,
    readonly other: TypedAddress,
    readonly owneds: TypedAddress[]
  ) { }

  get old(): false {
    return this.#class.old
  }

  get circuit(): false {
    return this.#class.circuit
  }

  get command() {
    return this.#class.command
  }

  sizeOrThrow() {
    return 0
      + 4
      + this.other.sizeOrThrow()
      + 1
      + this.owneds.reduce((p, c) => p + c.sizeOrThrow(), 0)
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint32OrThrow(this.time)
    this.other.writeOrThrow(cursor)
    cursor.writeUint8OrThrow(this.owneds.length)

    for (const owned of this.owneds)
      owned.writeOrThrow(cursor)

    return
  }

  static readOrThrow(cursor: Cursor) {
    const time = cursor.readUint32OrThrow()
    const other = TypedAddress.readOrThrow(cursor)

    const owneds = new Array<TypedAddress>(cursor.readUint8OrThrow())

    for (let i = 0; i < owneds.length; i++)
      owneds[i] = TypedAddress.readOrThrow(cursor)

    cursor.offset += cursor.remaining

    return new NetinfoCell(time, other, owneds)
  }

}