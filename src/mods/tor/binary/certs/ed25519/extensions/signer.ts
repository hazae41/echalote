import { BinaryReadError } from "@hazae41/binary";
import { Bytes } from "@hazae41/bytes";
import { Cursor } from "@hazae41/cursor";
import { Result } from "@hazae41/result";

export class SignedWithEd25519Key {
  readonly #class = SignedWithEd25519Key

  static readonly type = 4

  constructor(
    readonly key: Bytes<32>
  ) { }

  get type(): 4 {
    return this.#class.type
  }

  static tryRead(cursor: Cursor): Result<SignedWithEd25519Key, BinaryReadError> {
    return cursor.tryRead(32).mapSync(x => new SignedWithEd25519Key(x))
  }

}