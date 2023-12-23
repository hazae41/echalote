import { Writable } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";

export class Resizer {

  inner: Cursor<Uint8Array>

  constructor(
    readonly minimum = 2 ** 10,
    readonly maximum = 2 ** 20,
  ) {
    this.inner = new Cursor(new Uint8Array(this.minimum))
  }

  writeOrThrow(chunk: Uint8Array) {
    const length = this.inner.offset + chunk.length

    if (length > this.maximum)
      throw new Error(`Maximum size exceeded`)

    if (length > this.inner.length) {
      const resized = new Cursor(new Uint8Array(length))
      resized.writeOrThrow(this.inner.before)
      this.inner = resized
    }

    this.inner.writeOrThrow(chunk)
  }

  writeFromOrThrow(writable: Writable) {
    const length = this.inner.offset + writable.sizeOrThrow()

    if (length > this.maximum)
      throw new Error(`Maximum size exceeded`)

    if (length > this.inner.length) {
      const resized = new Cursor(new Uint8Array(length))
      resized.writeOrThrow(this.inner.before)
      this.inner = resized
    }

    writable.writeOrThrow(this.inner)
  }

}