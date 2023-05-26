import { Cursor } from "@hazae41/cursor";
import { Ok, Result } from "@hazae41/result";

export class RelayBeginDirCell {
  readonly #class = RelayBeginDirCell

  static readonly stream = true
  static readonly rcommand = 13

  constructor() { }

  get rcommand() {
    return this.#class.rcommand
  }

  trySize(): Result<number, never> {
    return new Ok(0)
  }

  tryWrite(cursor: Cursor): Result<void, never> {
    cursor.fill(0, cursor.remaining)

    return Ok.void()
  }

}