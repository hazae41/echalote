import { BinaryReadError, Opaque, Writable } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { Result } from "@hazae41/result";

export class RelayDataCell<Fragment extends Writable.Infer<Fragment>> {
  readonly #class = RelayDataCell

  static readonly stream = true
  static readonly rcommand = 2

  constructor(
    readonly fragment: Fragment
  ) { }

  get stream(): true {
    return this.#class.stream
  }

  get rcommand(): 2 {
    return this.#class.rcommand
  }

  trySize(): Result<number, Writable.SizeError<Fragment>> {
    return this.fragment.trySize()
  }

  tryWrite(cursor: Cursor): Result<void, Writable.WriteError<Fragment>> {
    return this.fragment.tryWrite(cursor)
  }

  static tryRead(cursor: Cursor): Result<RelayDataCell<Opaque>, BinaryReadError> {
    return cursor.tryRead(cursor.remaining).mapSync(x => new RelayDataCell(new Opaque(x)))
  }

}