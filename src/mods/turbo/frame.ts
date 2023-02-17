import { Cursor } from "@hazae41/binary";
import { Bitset } from "@hazae41/bitset";

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

  write6(cursor: Cursor) {
    const first = new Bitset(this.data.length, 8)
    first.setBE(0, !this.padding)
    first.setBE(1, false)
    first.unsign()

    cursor.writeUint8(first.value)
    cursor.write(this.data)
  }

  write13(cursor: Cursor) {
    let bits = ""
    bits += this.padding ? "0" : "1"
    bits += "1"

    const length = this.data.length.toString(2).padStart(13, "0")

    bits += length.slice(0, 6)
    bits += "0"
    bits += length.slice(6, 13)

    cursor.writeUint16(parseInt(bits, 2))
    cursor.write(this.data)
  }

  write20(cursor: Cursor) {
    let bits = ""
    bits += this.padding ? "0" : "1"
    bits += "1"

    const length = this.data.length.toString(2).padStart(20, "0")

    bits += length.slice(0, 6)
    bits += "1"
    bits += length.slice(6, 13)
    bits += "0"
    bits += length.slice(13, 20)

    cursor.writeUint24(parseInt(bits, 2))
    cursor.write(this.data)
  }

  write(cursor: Cursor) {
    if (this.data.length < 64)
      return this.write6(cursor)
    if (this.data.length < 8192)
      return this.write13(cursor)
    if (this.data.length < 1048576)
      return this.write20(cursor)
    throw new Error(`${this.#class.name}: write() max data length`)
  }

  export() {
    const cursor = Cursor.allocUnsafe(this.size())
    this.write(cursor)
    return cursor.bytes
  }

  /**
   * Read from bytes
   * @param binary bytes
   */
  static read(cursor: Cursor) {
    let lengthBits = ""

    const first = cursor.readUint8()
    const bits = new Bitset(first, 8)

    const padding = !bits.getBE(0)
    const continuation = bits.getBE(1)

    lengthBits += bits.last(6).toString()

    if (continuation) {
      const second = cursor.readUint8()
      const bits2 = new Bitset(second, 8)
      const continuation2 = bits2.getBE(0)

      lengthBits += bits2.last(7).toString()

      if (continuation2) {
        const third = cursor.readUint8()
        const bits3 = new Bitset(third, 8)
        const continuation3 = bits3.getBE(0)

        lengthBits += bits3.last(7).toString()

        if (continuation3) {
          throw new Error(`${this.name}: read continuation on 3rd byte`)
        }
      }
    }

    const length = parseInt(lengthBits, 2)
    const data = cursor.read(length)

    return new this(padding, data)
  }
}