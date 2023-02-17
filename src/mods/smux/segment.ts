import { Cursor } from "@hazae41/binary"

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

  write(cursor: Cursor) {
    cursor.writeUint8(this.version)
    cursor.writeUint8(this.command)
    cursor.writeUint16(this.data.length, true)
    cursor.writeUint32(this.stream, true)
    cursor.write(this.data)
  }

  static read(cursor: Cursor) {
    const version = cursor.readUint8()
    const command = cursor.readUint8()
    const length = cursor.readUint16(true)
    const stream = cursor.readUint32(true)
    const data = cursor.read(length)

    return new this(version, command, stream, data)
  }

  static tryRead(cursor: Cursor) {
    const offset = cursor.offset

    try {
      return this.read(cursor)
    } catch (e: unknown) {
      cursor.offset = offset
    }
  }
}