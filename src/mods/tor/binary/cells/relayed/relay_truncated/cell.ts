import { Cursor } from "@hazae41/cursor";
import { DestroyCell } from "mods/tor/binary/cells/direct/destroy/cell.js";

export class RelayTruncatedCell {
  readonly #class = RelayTruncatedCell

  static readonly early = false
  static readonly stream = false
  static readonly rcommand = 9

  static readonly reasons = DestroyCell.reasons

  constructor(
    readonly reason: number
  ) { }

  get early(): false {
    return this.#class.early
  }

  get stream(): false {
    return this.#class.stream
  }

  get rcommand(): 9 {
    return this.#class.rcommand
  }

  sizeOrThrow() {
    return 1
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(this.reason)
  }

  static readOrThrow(cursor: Cursor) {
    return new RelayTruncatedCell(cursor.readUint8OrThrow())
  }

}