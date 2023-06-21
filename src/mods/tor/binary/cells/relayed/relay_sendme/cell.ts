import { BinaryReadError, BinaryWriteError, Opaque, Writable } from "@hazae41/binary";
import { Bytes } from "@hazae41/bytes";
import { Cursor } from "@hazae41/cursor";
import { Ok, Result } from "@hazae41/result";

export class RelaySendmeCircuitCell<T extends Writable.Infer<T>> {
  readonly #class = RelaySendmeCircuitCell

  static readonly early = false
  static readonly stream = false
  static readonly rcommand = 5

  static readonly versions = {
    0: 0,
    1: 1
  } as const

  constructor(
    readonly version: number,
    readonly fragment: T
  ) { }

  get early(): false {
    return this.#class.early
  }

  get stream(): false {
    return this.#class.stream
  }

  get rcommand(): 5 {
    return this.#class.rcommand
  }

  trySize(): Result<number, Writable.SizeError<T>> {
    return this.fragment.trySize().mapSync(x => 1 + 2 + x)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError | Writable.SizeError<T> | Writable.WriteError<T>> {
    return Result.unthrowSync(t => {
      cursor.tryWriteUint8(this.version).throw(t)
      cursor.tryWriteUint16(this.fragment.trySize().throw(t))
      this.fragment.tryWrite(cursor).throw(t)

      return Ok.void()
    })
  }

  static tryRead(cursor: Cursor): Result<RelaySendmeCircuitCell<Opaque>, BinaryReadError> {
    return Result.unthrowSync(t => {
      const version = cursor.tryReadUint8().throw(t)
      const length = cursor.tryReadUint16().throw(t)
      const bytes = cursor.tryRead(length).throw(t)
      const data = new Opaque(bytes)

      return new Ok(new RelaySendmeCircuitCell(version, data))
    })
  }

}

export class RelaySendmeStreamCell<T extends Writable.Infer<T>> {
  readonly #class = RelaySendmeStreamCell

  static readonly early = false
  static readonly stream = true
  static readonly rcommand = 5

  static readonly versions = {
    0: 0,
    1: 1
  } as const

  constructor(
    readonly version: number,
    readonly fragment: T
  ) { }

  get early(): false {
    return this.#class.early
  }

  get stream(): true {
    return this.#class.stream
  }

  get rcommand(): 5 {
    return this.#class.rcommand
  }

  trySize(): Result<number, Writable.SizeError<T>> {
    return this.fragment.trySize().mapSync(x => 1 + 2 + x)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError | Writable.SizeError<T> | Writable.WriteError<T>> {
    return Result.unthrowSync(t => {
      cursor.tryWriteUint8(this.version).throw(t)
      cursor.tryWriteUint16(this.fragment.trySize().throw(t))
      this.fragment.tryWrite(cursor).throw(t)

      return Ok.void()
    })
  }

  static tryRead(cursor: Cursor): Result<RelaySendmeStreamCell<Opaque>, BinaryReadError> {
    return Result.unthrowSync(t => {
      const version = cursor.tryReadUint8().throw(t)
      const length = cursor.tryReadUint16().throw(t)
      const bytes = cursor.tryRead(length).throw(t)
      const data = new Opaque(bytes)

      return new Ok(new RelaySendmeStreamCell(version, data))
    })
  }

}

export class RelaySendmeDigest {

  constructor(
    readonly digest: Bytes<20>
  ) { }

  trySize(): Result<number, never> {
    return new Ok(this.digest.length)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return Result.unthrowSync(t => {
      cursor.tryWrite(this.digest).throw(t)

      return Ok.void()
    })
  }

  static tryRead(cursor: Cursor): Result<RelaySendmeDigest, BinaryReadError> {
    return Result.unthrowSync(t => {
      const digest = cursor.tryRead(20).throw(t)

      return new Ok(new RelaySendmeDigest(digest))
    })
  }
}