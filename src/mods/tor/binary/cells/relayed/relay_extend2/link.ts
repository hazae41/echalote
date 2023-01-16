import { Binary } from "@hazae41/binary"

export type RelayExtend2Link =
  | RelayExtend2LinkIPv4
  | RelayExtend2LinkIPv6
  | RelayExtend2LinkLegacyID
  | RelayExtend2LinkModernID

export class RelayExtend2LinkIPv4 {
  readonly #class = RelayExtend2LinkIPv4

  static type = 0

  constructor(
    readonly hostname: string,
    readonly port: number,
  ) { }

  write(binary: Binary) {
    binary.writeUint8(this.#class.type)
    binary.writeUint8(4 + 2)

    const [a, b, c, d] = this.hostname.split(".")
    binary.writeUint8(Number(a))
    binary.writeUint8(Number(b))
    binary.writeUint8(Number(c))
    binary.writeUint8(Number(d))

    binary.writeUint16(this.port)
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

  write(binary: Binary) {
    binary.writeUint8(this.#class.type)
    binary.writeUint8(16 + 2)

    const [a, b, c, d, e, f, g, h] = this.hostname.split(":")
    binary.writeUint16(Number(`0x${a}`) || 0)
    binary.writeUint16(Number(`0x${b}`) || 0)
    binary.writeUint16(Number(`0x${c}`) || 0)
    binary.writeUint16(Number(`0x${d}`) || 0)
    binary.writeUint16(Number(`0x${e}`) || 0)
    binary.writeUint16(Number(`0x${f}`) || 0)
    binary.writeUint16(Number(`0x${g}`) || 0)
    binary.writeUint16(Number(`0x${h}`) || 0)

    binary.writeUint16(this.port)
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

  write(binary: Binary) {
    binary.writeUint8(this.#class.type)
    binary.writeUint8(20)
    binary.write(this.fingerprint)
  }
}

export class RelayExtend2LinkModernID {
  readonly #class = RelayExtend2LinkModernID

  static type = 3

  constructor(
    readonly fingerprint: Uint8Array
  ) { }

  write(binary: Binary) {
    binary.writeUint8(this.#class.type)
    binary.writeUint8(32)
    binary.write(this.fingerprint)
  }
}