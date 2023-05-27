import { BinaryReadError, Opaque, Writable } from "@hazae41/binary";
import { Cursor } from "@hazae41/cursor";
import { Result } from "@hazae41/result";

export class RelayDropCell<Fragment extends Writable.Infer<Fragment>> {
  readonly #class = RelayDropCell

  static readonly stream = true
  static readonly rcommand = 10

  constructor(
    readonly fragment: Fragment
  ) { }

  get rcommand() {
    return this.#class.rcommand
  }

  trySize(): Result<number, Writable.SizeError<Fragment>> {
    return this.fragment.trySize()
  }

  tryWrite(cursor: Cursor): Result<void, Writable.WriteError<Fragment>> {
    return this.fragment.tryWrite(cursor)
  }

  static tryRead(cursor: Cursor): Result<RelayDropCell<Opaque>, BinaryReadError> {
    return cursor.tryRead(cursor.remaining).mapSync(x => new RelayDropCell(new Opaque(x)))
  }

}