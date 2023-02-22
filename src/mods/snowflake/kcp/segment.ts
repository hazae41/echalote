import { Cursor, Opaque, Readable, UnsafeOpaque, Writable } from "@hazae41/binary";

export class KcpSegment<T extends Writable> {
  readonly #class = KcpSegment

  static readonly commands = {
    push: 81,
    ack: 82,
    wask: 83,
    wins: 84
  } as const

  constructor(
    /**
     * conv
     */
    readonly conversation: number,
    /**
     * cmd
     */
    readonly command: number,
    /**
     * frg
     */
    readonly count = 0,
    /**
     * wnd
     */
    readonly window = 65535,
    /**
     * ts
     */
    readonly timestamp = Math.ceil(Date.now() / 1000),
    /**
     * sn
     */
    readonly serial: number,
    /**
     * una
     */
    readonly unackSerial: number,
    /**
     * data
     */
    readonly fragment: T
  ) { }

  static new<T extends Writable>(params: {
    conversation: number,
    command: number,
    count?: number,
    window?: number,
    timestamp?: number,
    serial: number,
    unackSerial: number,
    fragment: T
  }) {
    const { conversation, command, count, window, timestamp, serial, unackSerial, fragment } = params
    return new this(conversation, command, count, window, timestamp, serial, unackSerial, fragment)
  }

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
      + 4
      + 1
      + 1
      + 2
      + 4
      + 4
      + 4
      + 4
      + size
  }

  write(cursor: Cursor) {
    if (!this.#data)
      throw new Error(`Unprepared ${this.#class.name}`)
    const { size } = this.#data

    cursor.writeUint32(this.conversation, true)
    cursor.writeUint8(this.command)
    cursor.writeUint8(this.count)
    cursor.writeUint16(this.window, true)
    cursor.writeUint32(this.timestamp, true)
    cursor.writeUint32(this.serial, true)
    cursor.writeUint32(this.unackSerial, true)
    cursor.writeUint32(size, true)
    this.fragment.write(cursor)
  }

  static read(cursor: Cursor) {
    const conversation = cursor.readUint32(true)
    const command = cursor.readUint8()
    const count = cursor.readUint8()
    const window = cursor.readUint16(true)
    const timestamp = cursor.readUint32(true)
    const serial = cursor.readUint32(true)
    const unackSerial = cursor.readUint32(true)
    const length = cursor.readUint32(true)
    const bytes = cursor.read(length)

    const opaque = Readable.fromBytes(UnsafeOpaque, bytes)

    return new this<Opaque>(conversation, command, count, window, timestamp, serial, unackSerial, opaque)
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