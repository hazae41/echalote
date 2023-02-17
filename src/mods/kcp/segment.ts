import { Cursor } from "@hazae41/binary";

export class KcpSegment {

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
    readonly count: number,
    /**
     * wnd
     */
    readonly window: number,
    /**
     * ts
     */
    readonly timestamp: number,
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
    readonly data: Uint8Array
  ) { }

  size() {
    return 0
      + 4
      + 1
      + 1
      + 2
      + 4
      + 4
      + 4
      + 4
      + this.data.length
  }

  write(cursor: Cursor) {
    cursor.writeUint32(this.conversation, true)
    cursor.writeUint8(this.command)
    cursor.writeUint8(this.count)
    cursor.writeUint16(this.window, true)
    cursor.writeUint32(this.timestamp, true)
    cursor.writeUint32(this.serial, true)
    cursor.writeUint32(this.unackSerial, true)
    cursor.writeUint32(this.data.length, true)
    cursor.write(this.data)
  }

  export() {
    const cursor = Cursor.allocUnsafe(this.size())
    this.write(cursor)
    return cursor.bytes
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
    const data = cursor.read(length)

    return new this(conversation, command, count, window, timestamp, serial, unackSerial, data)
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