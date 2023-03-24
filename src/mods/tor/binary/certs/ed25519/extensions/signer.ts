import { Cursor } from "@hazae41/binary";
import { Extension } from "mods/tor/binary/certs/ed25519/extensions/extension.js";

export class SignedWithEd25519Key implements Extension {
  readonly #class = SignedWithEd25519Key

  static type = 4

  constructor(
    readonly length: number,
    readonly flags: number,
    readonly key: Uint8Array
  ) { }

  get type() {
    return this.#class.type
  }

  write(cursor: Cursor) {
    throw new Error(`Unimplemented`)
  }

  static read(cursor: Cursor, length: number, flags: number) {
    const start = cursor.offset

    const key = cursor.read(32)

    if (cursor.offset - start !== length)
      throw new Error(`Invalid Ed25519 cert extension SignedWithEd25519Key length ${length}`)
    return new this(length, flags, key)
  }
}