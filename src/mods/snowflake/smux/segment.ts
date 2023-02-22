import { Cursor, Opaque, Readable, UnsafeOpaque, Writable } from "@hazae41/binary"

export class SmuxUpdate {

  constructor(
    readonly consumed: number,
    readonly window: number
  ) { }

  size() {
    return 4 + 4
  }

  write(cursor: Cursor) {
    cursor.writeUint32(this.consumed, true)
    cursor.writeUint32(this.window, true)
  }

  static read(cursor: Cursor) {
    const consumed = cursor.readUint32(true)
    const window = cursor.readUint32(true)

    return new this(consumed, window)
  }

}

export class SmuxSegment<T extends Writable> {
  readonly #class = SmuxSegment

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
    readonly fragment: T
  ) { }

  #data?: {
    size: number
  }

  prepare() {
    const size = this.fragment.size()
    this.#data = { size }
    return this
  }

  size() {
    if (!this.#data)
      throw new Error(`Unprepared ${this.#class.name}`)
    const { size } = this.#data

    return 0
      + 1
      + 1
      + 2
      + 4
      + size
  }

  write(cursor: Cursor) {
    if (!this.#data)
      throw new Error(`Unprepared ${this.#class.name}`)
    const { size } = this.#data

    cursor.writeUint8(this.version)
    cursor.writeUint8(this.command)
    cursor.writeUint16(size, true)
    cursor.writeUint32(this.stream, true)
    this.fragment.write(cursor)
  }

  static read(cursor: Cursor) {
    const version = cursor.readUint8()
    const command = cursor.readUint8()
    const length = cursor.readUint16(true)
    const stream = cursor.readUint32(true)
    const bytes = cursor.read(length)

    const opaque = Readable.fromBytes(UnsafeOpaque, bytes)

    return new this<Opaque>(version, command, stream, opaque)
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