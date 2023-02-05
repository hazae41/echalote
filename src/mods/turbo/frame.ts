import { Binary } from "@hazae41/binary";
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
    let bits = ""
    bits += this.padding ? "1" : "0"
    bits += "1"

    const length = this.data.length.toString(2).padStart(13, "0")

    bits += length.slice(0, 6)
    bits += "1"
    bits += length.slice(6, 13)

    binary.writeUint16(parseInt(bits, 2))
    binary.write(this.data)
  }

  write20(binary: Binary) {
    let bits = ""
    bits += this.padding ? "1" : "0"
    bits += "1"

    const length = this.data.length.toString(2).padStart(20, "0")

    bits += length.slice(0, 6)
    bits += "1"
    bits += length.slice(6, 13)
    bits += "1"
    bits += length.slice(13, 20)

    binary.writeUint24(parseInt(bits, 2))
    binary.write(this.data)
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

  export() {
    const binary = Binary.allocUnsafe(this.size())
    this.write(binary)
    return binary.bytes
  }

  /**
   * Read from bytes
   * @param binary bytes
   */
  static read(binary: Binary) {
    let length = ""

    const first = binary.readUint8()
    const bits = new Bitset(first, 8)

    const padding = bits.get(0)
    const continuation = bits.get(1)

    length += bits.last(6).toString(2)

    if (continuation) {
      const second = binary.readUint8()
      const bits2 = new Bitset(second, 8)
      const continuation2 = bits2.get(0)

      length += bits2.last(7).toString(2)

      if (continuation2) {
        const third = binary.readUint8()
        const bits3 = new Bitset(third, 8)
        const continuation3 = bits3.get(0)

        length += bits3.last(7).toString(2)

        if (continuation3) {
          throw new Error(`${this.name}: read continuation on 3rd byte`)
        }
      }
    }

    const data = binary.read(parseInt(length, 2))
    return new this(padding, data)
  }
}