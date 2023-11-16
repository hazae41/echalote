import { Opaque, Writable } from "@hazae41/binary";
import { Bitset } from "@hazae41/bitset";
import { Cursor } from "@hazae41/cursor";
import { Result } from "@hazae41/result";

export type TurboFrameError =
  | UnexpectedContinuationError
  | FragmentOverflowError

export class FragmentOverflowError extends Error {
  readonly #class = FragmentOverflowError
  readonly name = this.#class.name

  constructor() {
    super(`Fragment size is greater than or equals to 2**20`)
  }

}

export class UnexpectedContinuationError extends Error {
  readonly #class = UnexpectedContinuationError
  readonly name = this.#class.name

  constructor() {
    super(`Unexpected continuation bit on third byte`)
  }

}

export interface TurboFrameParams<T extends Writable> {
  readonly padding: boolean,
  readonly fragment: T
}

export class TurboFrame<T extends Writable> {
  readonly #class = TurboFrame

  private constructor(
    readonly padding: boolean,
    readonly fragment: T,
    readonly fragmentSize: number
  ) { }

  static createOrThrow<T extends Writable>(params: TurboFrameParams<T>): TurboFrame<T> {
    const { padding, fragment } = params

    const fragmentSize = fragment.sizeOrThrow()

    if (fragmentSize >= (2 ** 20))
      throw new FragmentOverflowError()

    return new TurboFrame(padding, fragment, fragmentSize)
  }

  static tryCreate<T extends Writable>(params: TurboFrameParams<T>): Result<TurboFrame<T>, Error> {
    return Result.runAndDoubleWrapSync(() => TurboFrame.createOrThrow(params))
  }

  sizeOrThrow() {
    if (this.fragmentSize < (2 ** 6))
      return 1 + this.fragmentSize
    if (this.fragmentSize < (2 ** 13))
      return 2 + this.fragmentSize
    if (this.fragmentSize < (2 ** 20))
      return 3 + this.fragmentSize

    throw new FragmentOverflowError()
  }

  writeOrThrow(cursor: Cursor) {
    if (this.fragmentSize < (2 ** 6))
      return this.writeOrThrow6(cursor, this.fragmentSize)
    if (this.fragmentSize < (2 ** 13))
      return this.writeOrThrow13(cursor, this.fragmentSize)
    if (this.fragmentSize < (2 ** 20))
      return this.writeOrThrow20(cursor, this.fragmentSize)

    throw new FragmentOverflowError()
  }

  writeOrThrow6(cursor: Cursor, size: number) {
    const first = new Bitset(size, 8)
    first.setBE(0, !this.padding)
    first.setBE(1, false)
    first.unsign()

    cursor.writeUint8OrThrow(first.value)
    this.fragment.writeOrThrow(cursor)
  }

  writeOrThrow13(cursor: Cursor, size: number) {
    let bits = ""
    bits += this.padding ? "0" : "1"
    bits += "1"

    const length = size.toString(2).padStart(13, "0")

    bits += length.slice(0, 6)
    bits += "0"
    bits += length.slice(6, 13)

    cursor.writeUint16OrThrow(parseInt(bits, 2))
    this.fragment.writeOrThrow(cursor)
  }

  writeOrThrow20(cursor: Cursor, size: number) {
    let bits = ""
    bits += this.padding ? "0" : "1"
    bits += "1"

    const length = size.toString(2).padStart(20, "0")

    bits += length.slice(0, 6)
    bits += "1"
    bits += length.slice(6, 13)
    bits += "0"
    bits += length.slice(13, 20)

    cursor.writeUint24OrThrow(parseInt(bits, 2))
    this.fragment.writeOrThrow(cursor)
  }

  /**
   * Read from bytes
   * @param binary bytes
   */
  static readOrThrow(cursor: Cursor) {
    let lengthBits = ""

    const first = cursor.readUint8OrThrow()
    const bits = new Bitset(first, 8)

    const padding = !bits.getBE(0)
    const continuation = bits.getBE(1)

    lengthBits += bits.last(6).toString()

    if (continuation) {
      const second = cursor.readUint8OrThrow()
      const bits2 = new Bitset(second, 8)
      const continuation2 = bits2.getBE(0)

      lengthBits += bits2.last(7).toString()

      if (continuation2) {
        const third = cursor.readUint8OrThrow()
        const bits3 = new Bitset(third, 8)
        const continuation3 = bits3.getBE(0)

        lengthBits += bits3.last(7).toString()

        if (continuation3)
          throw new UnexpectedContinuationError()
      }
    }

    const length = parseInt(lengthBits, 2)
    const bytes = cursor.readAndCopyOrThrow(length)
    const fragment = new Opaque(bytes)

    return TurboFrame.createOrThrow({ padding, fragment })
  }
}