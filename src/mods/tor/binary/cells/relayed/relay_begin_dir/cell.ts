import { Cursor } from "@hazae41/cursor";

export class RelayBeginDirCell {
  readonly #class = RelayBeginDirCell

  static readonly stream = true
  static readonly rcommand = 13

  constructor() { }

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