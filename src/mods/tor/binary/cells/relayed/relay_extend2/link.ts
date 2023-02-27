import { Cursor } from "@hazae41/binary"

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

  static type = 0

  constructor(
    readonly hostname: string,
    readonly port: number,
  ) { }

  size() {
    return 1 + 1 + (4 * 1) + 2
  }

  write(cursor: Cursor) {
    cursor.writeUint8(this.#class.type)
    cursor.writeUint8(4 + 2)

    const [a, b, c, d] = this.hostname.split(".")
    cursor.writeUint8(Number(a))
    cursor.writeUint8(Number(b))
    cursor.writeUint8(Number(c))
    cursor.writeUint8(Number(d))

    cursor.writeUint16(this.port)
  }

  static from(host: string) {
    const { hostname, port } = new URL(`http://${host}`)
    return new this(hostname, Number(port))
  }
}

export class RelayExtend2LinkIPv6 {
  readonly #class = RelayExtend2LinkIPv6

  static type = 1

  constructor(
    readonly hostname: string,
    readonly port: number,
  ) { }

  size() {
    return 1 + 1 + (8 * 2) + 2
  }

  write(cursor: Cursor) {
    cursor.writeUint8(this.#class.type)
    cursor.writeUint8(16 + 2)

    const [a, b, c, d, e, f, g, h] = this.hostname.split(":")
    cursor.writeUint16(Number(`0x${a}`) || 0)
    cursor.writeUint16(Number(`0x${b}`) || 0)
    cursor.writeUint16(Number(`0x${c}`) || 0)
    cursor.writeUint16(Number(`0x${d}`) || 0)
    cursor.writeUint16(Number(`0x${e}`) || 0)
    cursor.writeUint16(Number(`0x${f}`) || 0)
    cursor.writeUint16(Number(`0x${g}`) || 0)
    cursor.writeUint16(Number(`0x${h}`) || 0)

    cursor.writeUint16(this.port)
  }

  static from(host: string) {
    const { hostname, port } = new URL(`http://${host}`)
    return new this(hostname.slice(1, -1), Number(port))
  }
}

export class RelayExtend2LinkLegacyID {
  readonly #class = RelayExtend2LinkLegacyID

  static type = 2

  constructor(
    readonly fingerprint: Uint8Array
  ) { }

  size() {
    return 1 + 1 + this.fingerprint.length
  }

  write(cursor: Cursor) {
    cursor.writeUint8(this.#class.type)
    cursor.writeUint8(20)
    cursor.write(this.fingerprint)
  }
}

export class RelayExtend2LinkModernID {
  readonly #class = RelayExtend2LinkModernID

  static type = 3

  constructor(
    readonly fingerprint: Uint8Array
  ) { }

  size() {
    return 1 + 1 + this.fingerprint.length
  }

  write(cursor: Cursor) {
    cursor.writeUint8(this.#class.type)
    cursor.writeUint8(32)
    cursor.write(this.fingerprint)
  }
}