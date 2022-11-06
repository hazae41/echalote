import { Binary } from "libs/binary.js"
import { RelayEarlyCell } from "mods/tor/binary/cells/direct/relay_early/cell.js"
import { Circuit } from "mods/tor/circuit.js"
import { PAYLOAD_LEN } from "mods/tor/constants.js"

export type Link =
  | LinkIPv4
  | LinkIPv6
  | LinkLegacyID
  | LinkModernID

export class LinkIPv4 {
  readonly class = LinkIPv4

  static type = 0

  constructor(
    readonly hostname: string,
    readonly port: number,
  ) { }

  write(binary: Binary) {
    binary.writeUint8(this.class.type)
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

export class LinkIPv6 {
  readonly class = LinkIPv6

  static type = 1

  constructor(
    readonly hostname: string,
    readonly port: number,
  ) { }

  write(binary: Binary) {
    binary.writeUint8(this.class.type)
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

export class LinkLegacyID {
  readonly class = LinkLegacyID

  static type = 2

  constructor(
    readonly fingerprint: Buffer
  ) { }

  write(binary: Binary) {
    binary.writeUint8(this.class.type)
    binary.writeUint8(20)
    binary.write(this.fingerprint)
  }
}

export class LinkModernID {
  readonly class = LinkModernID

  static type = 3

  constructor(
    readonly fingerprint: Buffer
  ) { }

  write(binary: Binary) {
    binary.writeUint8(this.class.type)
    binary.writeUint8(32)
    binary.write(this.fingerprint)
  }
}

export class RelayExtend2Cell {
  readonly class = RelayExtend2Cell

  static rcommand = 14

  static types = {
    /**
     * The old, slow, and insecure handshake
     * @deprecated
     */
    TAP: 0,
    /**
     * The new, quick, and secure handshake
     */
    NTOR: 2
  }

  constructor(
    readonly circuit: Circuit,
    readonly stream: undefined,
    readonly type: number,
    readonly links: Link[],
    readonly data: Buffer
  ) { }

  async pack() {
    return await this.cell().pack()
  }

  cell() {
    const binary = Binary.allocUnsafe(PAYLOAD_LEN)

    binary.writeUint8(this.links.length)

    for (const link of this.links)
      link.write(binary)

    binary.writeUint16(this.type)
    binary.writeUint16(this.data.length)
    binary.write(this.data)

    return new RelayEarlyCell(this.circuit, this.stream, this.class.rcommand, binary.sliced)
  }
}