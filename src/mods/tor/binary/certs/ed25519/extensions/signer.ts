import { BinaryReadError } from "@hazae41/binary";
import { Bytes } from "@hazae41/bytes";
import { Cursor } from "@hazae41/cursor";
import { Ok, Result } from "@hazae41/result";
import { Extension } from "mods/tor/binary/certs/ed25519/extensions/extension.js";

export class SignedWithEd25519Key implements Extension {
  readonly #class = SignedWithEd25519Key

  static type = 4

  constructor(
    readonly length: number,
    readonly flags: number,
    readonly key: Bytes<32>
  ) { }

  get type() {
    return this.#class.type
  }

  static tryRead(cursor: Cursor, length: number, flags: number): Result<SignedWithEd25519Key, BinaryReadError> {
    return Result.unthrowSync(t => {
      const start = cursor.offset

      const key = cursor.tryRead(32).throw(t)

      if (cursor.offset - start !== length)
        throw new Error(`Invalid Ed25519 cert extension SignedWithEd25519Key length ${length}`)

      return new Ok(new SignedWithEd25519Key(length, flags, key))
    })
  }

}