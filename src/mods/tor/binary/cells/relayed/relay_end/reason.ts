import { BinaryReadError, BinaryWriteError } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { Ok, Result } from "@hazae41/result";
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

  trySize(): Result<number, never> {
    return new Ok(0)
  }

  tryWrite(cursor: Cursor): Result<void, never> {
    return Ok.void()
  }

}

export class RelayEndReasonExitPolicy {
  readonly #class = RelayEndReasonExitPolicy

  static readonly id = 4

  constructor(
    readonly address: Address4 | Address6,
    readonly ttl: Date
  ) { }

  get id() {
    return this.#class.id
  }

  trySize(): Result<number, never> {
    return new Ok(this.address.trySize().get() + 4)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return Result.unthrowSync(t => {
      this.address.tryWrite(cursor).throw(t)
      const ttlv = Dates.toSecondsDelay(this.ttl)
      cursor.tryWriteUint32(ttlv).throw(t)

      return Ok.void()
    })
  }

  static tryRead(cursor: Cursor): Result<RelayEndReasonExitPolicy, BinaryReadError> {
    return Result.unthrowSync(t => {
      const address = cursor.remaining === 8
        ? Address4.tryRead(cursor).throw(t)
        : Address6.tryRead(cursor).throw(t)

      const ttlv = cursor.tryReadUint32().throw(t)
      const ttl = Dates.fromSecondsDelay(ttlv)

      return new Ok(new RelayEndReasonExitPolicy(address, ttl))
    })
  }

}