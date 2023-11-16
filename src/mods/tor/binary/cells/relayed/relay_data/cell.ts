import { Opaque, Writable } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";

export class RelayDataCell<T extends Writable> {
  readonly #class = RelayDataCell

  static readonly early = false
  static readonly stream = true
  static readonly rcommand = 2

  constructor(
    readonly fragment: T
  ) { }

  get early(): false {
    return this.#class.early
  }

  get stream(): true {
    return this.#class.stream
  }

  get rcommand(): 2 {
    return this.#class.rcommand
  }

  sizeOrThrow() {
    return this.fragment.sizeOrThrow()
  }

  writeOrThrow(cursor: Cursor) {
    this.fragment.writeOrThrow(cursor)
  }

  static readOrThrow(cursor: Cursor) {
    return new RelayDataCell(new Opaque(cursor.readAndCopyOrThrow(cursor.remaining)))
  }

}