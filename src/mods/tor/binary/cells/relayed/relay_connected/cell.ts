import { Cursor } from "@hazae41/cursor"
import { Dates } from "libs/dates/dates.js"
import { Address4, Address6 } from "mods/tor/binary/address.js"
import { Unimplemented } from "mods/tor/errors.js"

export class UnknownAddressType extends Error {
  readonly #class = UnknownAddressType
  readonly name = this.#class.name

  constructor(
    readonly type: number
  ) {
    super(`Unknown address type ${type}`)
  }

}

export class RelayConnectedCell {
  readonly #class = RelayConnectedCell

  static readonly early = false
  static readonly stream = true
  static readonly rcommand = 4

  constructor(
    readonly address: Address4 | Address6,
    readonly ttl: Date
  ) { }

  get early(): false {
    return this.#class.early
  }

  get stream(): true {
    return this.#class.stream
  }

  get rcommand(): 4 {
    return this.#class.rcommand
  }

  sizeOrThrow(): never {
    throw new Unimplemented()
  }

  writeOrThrow(cursor: Cursor): never {
    throw new Unimplemented()
  }

  static readOrThrow(cursor: Cursor) {
    const ipv4 = Address4.readOrThrow(cursor)

    if (ipv4.address !== "0.0.0.0") {
      const ttlv = cursor.readUint32OrThrow()
      const ttl = Dates.fromSecondsDelay(ttlv)

      return new RelayConnectedCell(ipv4, ttl)
    }

    const type = cursor.readUint8OrThrow()

    if (type !== 6)
      throw new UnknownAddressType(type)

    const ipv6 = Address6.readOrThrow(cursor)

    const ttlv = cursor.readUint32OrThrow()
    const ttl = Dates.fromSecondsDelay(ttlv)

    return new RelayConnectedCell(ipv6, ttl)
  }

}