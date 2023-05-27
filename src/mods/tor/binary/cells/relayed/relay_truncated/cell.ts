import { BinaryReadError, BinaryWriteError } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { Ok, Result } from "@hazae41/result";
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

  trySize(): Result<number, never> {
    return new Ok(1)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return cursor.tryWriteUint8(this.reason)
  }

  static tryRead(cursor: Cursor): Result<RelayTruncatedCell, BinaryReadError> {
    return cursor.tryReadUint8().mapSync(x => new RelayTruncatedCell(x))
  }

}