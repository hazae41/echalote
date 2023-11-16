import { BinaryWriteError } from "@hazae41/binary"
import { Cursor } from "@hazae41/cursor"
import { Ok, Result } from "@hazae41/result"

export type RelayExtend2Link =
  | RelayExtend2LinkIPv4
  | RelayExtend2LinkIPv6
  | RelayExtend2LinkLegacyID
  | RelayExtend2LinkModernID

export namespace RelayExtend2Link {

  export function fromAddressString(address: string) {
    return address.startsWith("[")
      ? RelayExtend2LinkIPv6.from(address)
      : RelayExtend2LinkIPv4.from(address)
  }

}

export class RelayExtend2LinkIPv4 {
  readonly #class = RelayExtend2LinkIPv4

  static readonly type = 0

  constructor(
    readonly hostname: string,
    readonly port: number,
  ) { }

  static from(host: string) {
    const { hostname, port } = new URL(`http://${host}`)

    return new RelayExtend2LinkIPv4(hostname, Number(port))
  }

  trySize(): Result<number, never> {
    return new Ok(1 + 1 + (4 * 1) + 2)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return Result.unthrowSync(t => {
      cursor.tryWriteUint8(this.#class.type).throw(t)
      cursor.tryWriteUint8(4 + 2).throw(t)

      const [a, b, c, d] = this.hostname.split(".")
      cursor.tryWriteUint8(Number(a)).throw(t)
      cursor.tryWriteUint8(Number(b)).throw(t)
      cursor.tryWriteUint8(Number(c)).throw(t)
      cursor.tryWriteUint8(Number(d)).throw(t)

      cursor.tryWriteUint16(this.port).throw(t)

      return Ok.void()
    })
  }

}

export class RelayExtend2LinkIPv6 {
  readonly #class = RelayExtend2LinkIPv6

  static readonly type = 1

  constructor(
    readonly hostname: string,
    readonly port: number,
  ) { }

  static from(host: string) {
    const { hostname, port } = new URL(`http://${host}`)

    return new RelayExtend2LinkIPv6(hostname.slice(1, -1), Number(port))
  }

  trySize(): Result<number, never> {
    return new Ok(1 + 1 + (8 * 2) + 2)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return Result.unthrowSync(t => {
      cursor.tryWriteUint8(this.#class.type).throw(t)
      cursor.tryWriteUint8(16 + 2).throw(t)

      const [a, b, c, d, e, f, g, h] = this.hostname.split(":")
      cursor.tryWriteUint16(Number(`0x${a}`) || 0).throw(t)
      cursor.tryWriteUint16(Number(`0x${b}`) || 0).throw(t)
      cursor.tryWriteUint16(Number(`0x${c}`) || 0).throw(t)
      cursor.tryWriteUint16(Number(`0x${d}`) || 0).throw(t)
      cursor.tryWriteUint16(Number(`0x${e}`) || 0).throw(t)
      cursor.tryWriteUint16(Number(`0x${f}`) || 0).throw(t)
      cursor.tryWriteUint16(Number(`0x${g}`) || 0).throw(t)
      cursor.tryWriteUint16(Number(`0x${h}`) || 0).throw(t)

      cursor.tryWriteUint16(this.port).throw(t)

      return Ok.void()
    })
  }

}

export class RelayExtend2LinkLegacyID {
  readonly #class = RelayExtend2LinkLegacyID

  static readonly type = 2

  constructor(
    readonly fingerprint: Uint8Array
  ) { }

  trySize(): Result<number, never> {
    return new Ok(1 + 1 + this.fingerprint.length)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return Result.unthrowSync(t => {
      cursor.tryWriteUint8(this.#class.type).throw(t)
      cursor.tryWriteUint8(20).throw(t)
      cursor.tryWrite(this.fingerprint).throw(t)

      return Ok.void()
    })
  }

}

export class RelayExtend2LinkModernID {
  readonly #class = RelayExtend2LinkModernID

  static readonly type = 3

  constructor(
    readonly fingerprint: Uint8Array
  ) { }

  trySize(): Result<number, never> {
    return new Ok(1 + 1 + this.fingerprint.length)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return Result.unthrowSync(t => {
      cursor.tryWriteUint8(this.#class.type).throw(t)
      cursor.tryWriteUint8(32).throw(t)
      cursor.tryWrite(this.fingerprint).throw(t)

      return Ok.void()
    })
  }

}