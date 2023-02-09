import { Binary } from "@hazae41/binary"

export class SmuxSegment {

  static readonly versions = {
    one: 1,
    two: 2
  } as const

  static readonly commands = {
    syn: 0,
    fin: 1,
    psh: 2,
    nop: 3,
    upd: 4
  } as const

  constructor(
    readonly version: number,
    readonly command: number,
    readonly stream: number,
    readonly data: Uint8Array
  ) { }

  size() {
    return 0
      + 1
      + 1
      + 2
      + 4
      + this.data.length
  }

  write(binary: Binary) {
    binary.writeUint8(this.version)
    binary.writeUint8(this.command)
    binary.writeUint16(this.data.length, true)
    binary.writeUint32(this.stream, true)
    binary.write(this.data)
  }

  export() {
    const binary = Binary.allocUnsafe(this.size())
    this.write(binary)
    return binary.bytes
  }

  static read(binary: Binary) {
    const version = binary.readUint8()
    const command = binary.readUint8()
    const length = binary.readUint16(true)
    const stream = binary.readUint32(true)
    const data = binary.read(length)

    return new this(version, command, stream, data)
  }

  static tryRead(binary: Binary) {
    const offset = binary.offset

    try {
      return this.read(binary)
    } catch (e: unknown) {
      binary.offset = offset
    }
  }
}