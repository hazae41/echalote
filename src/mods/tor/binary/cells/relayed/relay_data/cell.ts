import { BinaryReadError, Opaque, Writable } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { Result } from "@hazae41/result";

export class RelayDataCell<T extends Writable.Infer<T>> {
  readonly #class = RelayDataCell

  static readonly stream = true
  static readonly rcommand = 2

  constructor(
    readonly data: T
  ) { }

  get rcommand() {
    return this.#class.rcommand
  }

  trySize(): Result<number, Writable.SizeError<T>> {
    return this.data.trySize()
  }

  tryWrite(cursor: Cursor): Result<void, Writable.WriteError<T>> {
    return this.data.tryWrite(cursor)
  }

  static tryRead(cursor: Cursor): Result<RelayDataCell<Opaque>, BinaryReadError> {
    return cursor.tryRead(cursor.remaining).mapSync(x => new RelayDataCell(new Opaque(x)))
  }

}