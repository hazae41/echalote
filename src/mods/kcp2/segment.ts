import { Cursor } from "@hazae41/binary";

export class Kcp2Segment {

  static readonly fecTypes = {
    data: 0xF1,
    parity: 0xF2
  }

  constructor(
    readonly nonce: Uint8Array,
    readonly checksum: number,
    readonly fecType: number,
    readonly fecSeqID: number,
    readonly data: Uint8Array
  ) { }

  size() {
    return 0
      + 16
      + 4
      + 4
      + 2
      + 2
      + this.data.length
  }

  write(cursor: Cursor) {
    cursor.write(this.nonce)
    cursor.writeUint32(this.checksum, true)
    cursor.writeUint32(this.fecSeqID, true)
    cursor.writeUint16(this.fecType, true)
    cursor.writeUint16(this.data.length + 2, true)
    cursor.write(this.data)
  }

  static read(cursor: Cursor) {
    const nonce = cursor.read(16)
    const checksum = cursor.readUint32(true)
    const fecSeqID = cursor.readUint32(true)
    const fecType = cursor.readUint16(true)
    const length = cursor.readUint16(true)
    const data = cursor.read(length - 2)

    return new this(nonce, checksum, fecType, fecSeqID, data)
  }
}