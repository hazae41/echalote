import { Binary } from "@hazae41/binary";

export class Kcp2Segment {

  constructor(
    readonly nonce: Uint8Array,
    readonly checksum: Uint8Array,
    readonly fecType: number,
    readonly fecSeqID: number,
    readonly data: Uint8Array
  ) { }

  size() {
    return 0
      + this.nonce.length
      + this.checksum.length
      + 4
      + 2
      + 2
      + this.data.length
  }

  write(binary: Binary) {

  }
}