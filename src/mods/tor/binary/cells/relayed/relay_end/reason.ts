import { Cursor } from "@hazae41/binary";
import { dateToTtl, ttlToDate } from "libs/time.js";
import { Address4, Address6 } from "mods/tor/binary/address.js";

export type RelayEndReason =
  | RelayEndReasonExitPolicy
  | RelayEndReasonOther

export class RelayEndReasonOther {
  readonly #class = RelayEndReasonOther

  constructor(
    readonly id: number
  ) { }

  write(cursor: Cursor) { }
}

export class RelayEndReasonExitPolicy {
  readonly #class = RelayEndReasonExitPolicy

  static id = 4

  constructor(
    readonly address: Address4 | Address6,
    readonly ttl: Date
  ) { }

  get id() {
    return this.#class.id
  }

  write(cursor: Cursor) {
    this.address.write(cursor)
    cursor.writeUint32(dateToTtl(this.ttl))
  }

  static read(cursor: Cursor) {
    const address = cursor.remaining === 8
      ? Address4.read(cursor)
      : Address6.read(cursor)

    const ttl = ttlToDate(cursor.readUint32())

    return new this(address, ttl)
  }
}