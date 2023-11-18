import { Cursor } from "@hazae41/cursor";

export class RelayBeginDirCell {
  readonly #class = RelayBeginDirCell

  static readonly early = false
  static readonly stream = true
  static readonly rcommand = 13

  constructor() { }

  get early(): false {
    return this.#class.early
  }

  get stream(): true {
    return this.#class.stream
  }

  get rcommand() {
    return this.#class.rcommand
  }

  sizeOrThrow() {
    return 0
  }

  writeOrThrow(cursor: Cursor) {
    cursor.fillOrThrow(0, cursor.remaining)
  }

}