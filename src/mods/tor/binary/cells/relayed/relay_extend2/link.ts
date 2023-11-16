import { Cursor } from "@hazae41/cursor"

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

  sizeOrThrow() {
    return 1 + 1 + (4 * 1) + 2
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(this.#class.type)
    cursor.writeUint8OrThrow(4 + 2)

    const [a, b, c, d] = this.hostname.split(".")
    cursor.writeUint8OrThrow(Number(a))
    cursor.writeUint8OrThrow(Number(b))
    cursor.writeUint8OrThrow(Number(c))
    cursor.writeUint8OrThrow(Number(d))

    cursor.writeUint16OrThrow(this.port)
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

  sizeOrThrow() {
    return 1 + 1 + (8 * 2) + 2
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(this.#class.type)
    cursor.writeUint8OrThrow(16 + 2)

    const [a, b, c, d, e, f, g, h] = this.hostname.split(":")
    cursor.writeUint16OrThrow(Number(`0x${a}`) || 0)
    cursor.writeUint16OrThrow(Number(`0x${b}`) || 0)
    cursor.writeUint16OrThrow(Number(`0x${c}`) || 0)
    cursor.writeUint16OrThrow(Number(`0x${d}`) || 0)
    cursor.writeUint16OrThrow(Number(`0x${e}`) || 0)
    cursor.writeUint16OrThrow(Number(`0x${f}`) || 0)
    cursor.writeUint16OrThrow(Number(`0x${g}`) || 0)
    cursor.writeUint16OrThrow(Number(`0x${h}`) || 0)

    cursor.writeUint16OrThrow(this.port)
  }

}

export class RelayExtend2LinkLegacyID {
  readonly #class = RelayExtend2LinkLegacyID

  static readonly type = 2

  constructor(
    readonly fingerprint: Uint8Array
  ) { }

  sizeOrThrow() {
    return 1 + 1 + this.fingerprint.length
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(this.#class.type)
    cursor.writeUint8OrThrow(20)
    cursor.writeOrThrow(this.fingerprint)
  }

}

export class RelayExtend2LinkModernID {
  readonly #class = RelayExtend2LinkModernID

  static readonly type = 3

  constructor(
    readonly fingerprint: Uint8Array
  ) { }

  sizeOrThrow() {
    return 1 + 1 + this.fingerprint.length
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(this.#class.type)
    cursor.writeUint8OrThrow(32)
    cursor.writeOrThrow(this.fingerprint)
  }

}