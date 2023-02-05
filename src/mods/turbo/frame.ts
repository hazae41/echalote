import { Binary } from "@hazae41/binary";
import { pack_left, unpack } from "@hazae41/naberius";
import { Bitset } from "libs/bitset/bitset.js";

export class TurboFrame {
  readonly #class = TurboFrame

  constructor(
    readonly padding: boolean,
    readonly data: Uint8Array
  ) { }

  size() {
    if (this.data.length < 64)
      return 1 + this.data.length
    if (this.data.length < 8192)
      return 2 + this.data.length
    if (this.data.length < 1048576)
      return 3 + this.data.length
    throw new Error(`${this.#class.name}: size() max data length`)
  }

  write6(binary: Binary) {
    const first = new Bitset(this.data.length, 8)
    first.set(0, this.padding)
    first.set(1, false)

    binary.writeUint8(first.unsigned())
    binary.write(this.data)
  }

  write13(binary: Binary) {
    const length = Binary.allocUnsafe(2)
    length.writeUint16(this.data.length)

    /**
     * lbits *000x xxxx xxxx xxxx
     */
    const lbits = unpack(length.bytes)
    const lbitsb = new Binary(lbits)

    /**
     * lbits 000*x xxxx xxxx xxxx
     */
    lbitsb.offset += 3

    /**
     * cbits ?0*00 0000 0000 0000
     */
    const cbitsb = Binary.allocUnsafe(2 * 8)
    cbitsb.writeUint8(this.padding ? 1 : 0)
    cbitsb.writeUint8(1)

    /**
     * cbits ?0xx xxxx* 0000 0000
     * lbits 000x xxxx x*xxx xxxx
     */
    cbitsb.write(lbitsb.read(6))

    /**
     * cbits ?0xx xxxx 0*000 0000
     * lbits 000x xxxx x*xxx xxxx
     */
    cbitsb.writeUint8(0)

    /**
     * cbits ?0xx xxxx xxxx xxxx*
     * lbits 000x xxxx xxxx xxxx*
     */
    cbitsb.write(lbitsb.read(7))

    binary.write(pack_left(cbitsb.bytes))
  }

  write20(binary: Binary) {
    const length = Binary.allocUnsafe(3)
    length.writeUint24(this.data.length)

    /**
     * lbits *0000 xxxx xxxx xxxx xxxx xxxx
     */
    const lbits = unpack(length.bytes)
    const lbitsb = new Binary(lbits)

    /**
     * lbits 0000* xxxx xxxx xxxx xxxx xxxx
     */
    lbitsb.offset += 4

    /**
     * cbits ?0*00 0000 0000 0000 0000 0000
     */
    const cbitsb = Binary.allocUnsafe(3 * 8)
    cbitsb.writeUint8(this.padding ? 1 : 0)
    cbitsb.writeUint8(1)

    /**
     * cbits ?0xx xxxx* 0000 0000 0000 0000
     * lbits 0000 xxxx xx*xx xxxx xxxx xxxx
     */
    cbitsb.write(lbitsb.read(6))

    /**
     * cbits ?0xx xxxx 0*000 0000 0000 0000
     * lbits 0000 xxxx xx*xx xxxx xxxx xxxx
     */
    cbitsb.writeUint8(0)

    /**
     * cbits ?0xx xxxx xxxx xxxx* 0000 0000
     * lbits 0000 xxxx xxxx xxxx x*xxx xxxx
     */
    cbitsb.write(lbitsb.read(7))

    /**
     * cbits ?0xx xxxx xxxx xxxx 0*000 0000
     * lbits 0000 xxxx xxxx xxxx x*xxx xxxx
     */
    cbitsb.writeUint8(0)

    /**
     * cbits ?0xx xxxx xxxx xxxx xxxx xxxx*
     * lbits 0000 xxxx xxxx xxxx xxxx xxxx*
     */
    cbitsb.write(lbitsb.read(7))

    binary.write(pack_left(cbitsb.bytes))
  }
  write(binary: Binary) {
    if (this.data.length < 64)
      return this.write6(binary)
    if (this.data.length < 8192)
      return this.write13(binary)
    if (this.data.length < 1048576)
      return this.write20(binary)
    throw new Error(`${this.#class.name}: write() max data length`)
  }

  /**
   * Read from bytes
   * @param binary bytes
   */
  static read(binary: Binary) {
    const first = binary.readUint8()
    const bits = new Bitset(first, 8)

    const padding = Boolean(bits.get(0))
    const continuation = Boolean(bits.get(1))
    let length = bits.last(6)

    if (continuation) {
      const second = binary.readUint8()
      const bits2 = new Bitset(second, 8)
      const continuation2 = Boolean(bits2.get(0))
      length += bits2.last(7)

      if (continuation2) {
        const third = binary.readUint8()
        const bits3 = new Bitset(third, 8)
        const continuation3 = Boolean(bits3.get(0))
        length += bits3.last(7)

        if (continuation3) {
          throw new Error(`${this.name}: read continuation on 3rd byte`)
        }
      }
    }

    const data = binary.read(length)
    return new this(padding, data)
  }
}