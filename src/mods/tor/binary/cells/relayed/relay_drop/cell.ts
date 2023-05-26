import { Writable } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { Result } from "@hazae41/result";

export class RelayDropCell<T extends Writable.Infer<T>> {
  readonly #class = RelayDropCell

  static readonly stream = true
  static readonly rcommand = 10

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

}