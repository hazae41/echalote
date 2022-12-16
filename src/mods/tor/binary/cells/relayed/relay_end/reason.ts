import { Binary } from "@hazae41/binary";
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

  write(binary: Binary) { }
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

  write(binary: Binary) {
    this.address.write(binary)
    binary.writeUint32(dateToTtl(this.ttl))
  }

  static read(binary: Binary) {
    const address = binary.remaining === 8
      ? Address4.read(binary)
      : Address6.read(binary)

    const ttl = ttlToDate(binary.readUint32())

    return new this(address, ttl)
  }
}