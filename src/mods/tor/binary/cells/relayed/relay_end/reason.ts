import { Cursor } from "@hazae41/binary";
import { Dates } from "libs/dates/dates.js";
import { Address4, Address6 } from "mods/tor/binary/address.js";

export type RelayEndReason =
  | RelayEndReasonExitPolicy
  | RelayEndReasonOther

export class RelayEndReasonOther {
  readonly #class = RelayEndReasonOther

  constructor(
    readonly id: number
  ) { }

  size() {
    return 0
  }

  write(cursor: Cursor) {
    /**
     * NOOP
     */
  }

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

  size() {
    return this.address.size() + 4
  }

  write(cursor: Cursor) {
    this.address.write(cursor)
    cursor.writeUint32(Dates.toSecondsDelay(this.ttl))
  }

  static read(cursor: Cursor) {
    const address = cursor.remaining === 8
      ? Address4.read(cursor)
      : Address6.read(cursor)

    const ttl = Dates.fromSecondsDelay(cursor.readUint32())

    return new this(address, ttl)
  }
}