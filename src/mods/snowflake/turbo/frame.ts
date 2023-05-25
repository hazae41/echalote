import { BinaryReadError, BinaryWriteError, Opaque, Readable, UnsafeOpaque, Writable } from "@hazae41/binary";
import { Bitset } from "@hazae41/bitset";
import { Cursor } from "@hazae41/cursor";
import { Err, Ok, Panic, Result } from "@hazae41/result";

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

export class TurboFrame<T extends Writable.Infer<T>> {
  readonly #class = TurboFrame

  private constructor(
    readonly padding: boolean,
    readonly fragment: T,
    readonly fragmentSize: number
  ) { }

  static tryNew<T extends Writable.Infer<T>>(params: {
    padding: boolean,
    fragment: T
  }): Result<TurboFrame<T>, Writable.SizeError<T> | FragmentOverflowError> {
    return Result.unthrowSync(t => {
      const { padding, fragment } = params

      const fragmentSize = fragment.trySize().throw(t)

      if (fragmentSize >= (2 ** 20))
        return new Err(new FragmentOverflowError())

      return new Ok(new TurboFrame(padding, fragment, fragmentSize))
    })
  }

  trySize(): Result<number, never> {
    if (this.fragmentSize < (2 ** 6))
      return new Ok(1 + this.fragmentSize)
    if (this.fragmentSize < (2 ** 13))
      return new Ok(2 + this.fragmentSize)
    if (this.fragmentSize < (2 ** 20))
      return new Ok(3 + this.fragmentSize)

    throw new Panic(`Should have failed earlier`, { cause: new FragmentOverflowError() })
  }

  tryWrite(cursor: Cursor) {
    if (this.fragmentSize < (2 ** 6))
      return this.tryWrite6(cursor, this.fragmentSize)
    if (this.fragmentSize < (2 ** 13))
      return this.tryWrite13(cursor, this.fragmentSize)
    if (this.fragmentSize < (2 ** 20))
      return this.tryWrite20(cursor, this.fragmentSize)

    throw new Panic(`Should have failed earlier`, { cause: new FragmentOverflowError() })
  }

  tryWrite6(cursor: Cursor, size: number): Result<void, Writable.WriteError<T> | BinaryWriteError> {
    return Result.unthrowSync(t => {
      const first = new Bitset(size, 8)
      first.setBE(0, !this.padding)
      first.setBE(1, false)
      first.unsign()

      cursor.tryWriteUint8(first.value).throw(t)
      this.fragment.tryWrite(cursor).throw(t)

      return Ok.void()
    })
  }

  tryWrite13(cursor: Cursor, size: number): Result<void, Writable.WriteError<T> | BinaryWriteError> {
    return Result.unthrowSync(t => {
      let bits = ""
      bits += this.padding ? "0" : "1"
      bits += "1"

      const length = size.toString(2).padStart(13, "0")

      bits += length.slice(0, 6)
      bits += "0"
      bits += length.slice(6, 13)

      cursor.tryWriteUint16(parseInt(bits, 2)).throw(t)
      this.fragment.tryWrite(cursor).throw(t)

      return Ok.void()
    })
  }

  tryWrite20(cursor: Cursor, size: number): Result<void, Writable.WriteError<T> | BinaryWriteError> {
    return Result.unthrowSync(t => {
      let bits = ""
      bits += this.padding ? "0" : "1"
      bits += "1"

      const length = size.toString(2).padStart(20, "0")

      bits += length.slice(0, 6)
      bits += "1"
      bits += length.slice(6, 13)
      bits += "0"
      bits += length.slice(13, 20)

      cursor.tryWriteUint24(parseInt(bits, 2)).throw(t)
      this.fragment.tryWrite(cursor).throw(t)

      return Ok.void()
    })
  }

  /**
   * Read from bytes
   * @param binary bytes
   */
  static tryRead(cursor: Cursor): Result<TurboFrame<Opaque>, BinaryReadError | FragmentOverflowError | UnexpectedContinuationError> {
    return Result.unthrowSync(t => {
      let lengthBits = ""

      const first = cursor.tryReadUint8().throw(t)
      const bits = new Bitset(first, 8)

      const padding = !bits.getBE(0)
      const continuation = bits.getBE(1)

      lengthBits += bits.last(6).toString()

      if (continuation) {
        const second = cursor.tryReadUint8().throw(t)
        const bits2 = new Bitset(second, 8)
        const continuation2 = bits2.getBE(0)

        lengthBits += bits2.last(7).toString()

        if (continuation2) {
          const third = cursor.tryReadUint8().throw(t)
          const bits3 = new Bitset(third, 8)
          const continuation3 = bits3.getBE(0)

          lengthBits += bits3.last(7).toString()

          if (continuation3)
            return new Err(new UnexpectedContinuationError())
        }
      }

      const length = parseInt(lengthBits, 2)
      const bytes = cursor.tryRead(length).throw(t)

      const fragment = Readable.tryReadFromBytes(UnsafeOpaque, bytes).throw(t)

      return TurboFrame.tryNew<Opaque>({ padding, fragment })
    })
  }
}