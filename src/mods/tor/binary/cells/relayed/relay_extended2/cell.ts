import { Opaque, Writable } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { Unimplemented } from "mods/tor/errors.js";

export class RelayExtended2Cell<T extends Writable> {
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

  sizeOrThrow(): never {
    throw new Unimplemented()
  }

  writeOrThrow(cursor: Cursor): never {
    throw new Unimplemented()
  }

  static readOrThrow(cursor: Cursor) {
    const length = cursor.readUint16OrThrow()
    const bytes = cursor.readAndCopyOrThrow(length)
    const data = new Opaque(bytes)

    return new RelayExtended2Cell(data)
  }

}