import { BinaryReadError, Opaque, Writable } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { Ok, Result } from "@hazae41/result";

export class RelayExtended2Cell<T extends Writable.Infer<T>> {
  readonly #class = RelayExtended2Cell

  static readonly stream = false
  static readonly rcommand = 15

  constructor(
    readonly data: T
  ) { }

  get rcommand() {
    return this.#class.rcommand
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