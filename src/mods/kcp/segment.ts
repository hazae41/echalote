import { Binary } from "@hazae41/binary";

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

  write(binary: Binary) {
    binary.writeUint32(this.conversation, true)
    binary.writeUint8(this.command)
    binary.writeUint8(this.count)
    binary.writeUint16(this.window, true)
    binary.writeUint32(this.timestamp, true)
    binary.writeUint32(this.serial, true)
    binary.writeUint32(this.unackSerial, true)
    binary.writeUint32(this.data.length, true)
    binary.write(this.data)
  }

  export() {
    const binary = Binary.allocUnsafe(this.size())
    this.write(binary)
    return binary.bytes
  }

  static read(binary: Binary) {
    const conversation = binary.readUint32(true)
    const command = binary.readUint8()
    const count = binary.readUint8()
    const window = binary.readUint16(true)
    const timestamp = binary.readUint32(true)
    const serial = binary.readUint32(true)
    const unackSerial = binary.readUint32(true)
    const length = binary.readUint32(true)

    console.log(length)

    const data = new Uint8Array(binary.read(length))

    return new this(conversation, command, count, window, timestamp, serial, unackSerial, data)
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