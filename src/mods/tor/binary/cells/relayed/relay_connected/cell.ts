import { BinaryReadError } from "@hazae41/binary"
import { Cursor } from "@hazae41/cursor"
import { Ok, Result } from "@hazae41/result"
import { Dates } from "libs/dates/dates.js"
import { Address4, Address6 } from "mods/tor/binary/address.js"

export class RelayConnectedCell {
  readonly #class = RelayConnectedCell

  static readonly stream = true
  static readonly rcommand = 4

  constructor(
    readonly address: Address4 | Address6,
    readonly ttl: Date
  ) { }

  get rcommand() {
    return this.#class.rcommand
  }

  static tryRead(cursor: Cursor): Result<RelayConnectedCell, BinaryReadError> {
    return Result.unthrowSync(t => {
      const ipv4 = Address4.tryRead(cursor).throw(t)

      if (ipv4.address !== "0.0.0.0") {
        const ttlv = cursor.tryReadUint32().throw(t)
        const ttl = Dates.fromSecondsDelay(ttlv)

        return new Ok(new RelayConnectedCell(ipv4, ttl))
      } else {
        const type = cursor.tryReadUint8().throw(t)

        if (type !== 6)
          throw new Error(`Unknown address type ${type}`)

        const ipv6 = Address6.tryRead(cursor).throw(t)

        const ttlv = cursor.tryReadUint32().throw(t)
        const ttl = Dates.fromSecondsDelay(ttlv)

        return new Ok(new RelayConnectedCell(ipv6, ttl))
      }
    })
  }

}