import { BinaryReadError, Opaque, Writable } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { Ok, Panic, Result, Unimplemented } from "@hazae41/result";

export class RelayExtended2Cell<T extends Writable.Infer<T>> {
  readonly #class = RelayExtended2Cell

  static readonly early = false
  static readonly stream = false
  static readonly rcommand = 15

  constructor(
    readonly fragment: T
  ) { }

  get early(): false {
    return this.#class.early
  }

  get stream(): false {
    return this.#class.stream
  }

  get rcommand(): 15 {
    return this.#class.rcommand
  }

  trySize(): Result<never, never> {
    throw Panic.from(new Unimplemented())
  }

  tryWrite(cursor: Cursor): Result<never, never> {
    throw Panic.from(new Unimplemented())
  }

  static tryRead(cursor: Cursor): Result<RelayExtended2Cell<Opaque>, BinaryReadError> {
    return Result.unthrowSync(t => {
      const length = cursor.tryReadUint16().throw(t)
      const bytes = cursor.tryRead(length).throw(t)
      const data = new Opaque(bytes)

      return new Ok(new RelayExtended2Cell(data))
    })
  }

}