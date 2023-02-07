import { Binary } from "@hazae41/binary";

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

  write(binary: Binary) {
    binary.write(this.nonce)
    binary.writeUint32(this.checksum, true)
    binary.writeUint32(this.fecSeqID, true)
    binary.writeUint16(this.fecType, true)
    binary.writeUint16(this.data.length + 2, true)
    binary.write(this.data)
  }

  static read(binary: Binary) {
    const nonce = binary.read(16)
    const checksum = binary.readUint32(true)
    const fecSeqID = binary.readUint32(true)
    const fecType = binary.readUint16(true)
    const length = binary.readUint16(true)
    const data = binary.read(length - 2)

    return new this(nonce, checksum, fecType, fecSeqID, data)
  }
}