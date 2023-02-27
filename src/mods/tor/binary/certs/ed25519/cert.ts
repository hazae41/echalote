import { Cursor } from "@hazae41/binary";
import { Cert as ICert } from "mods/tor/binary/certs/cert.js";
import { SignedWithEd25519Key } from "mods/tor/binary/certs/ed25519/extensions/signer.js";

export interface Extensions {
  signer?: SignedWithEd25519Key
}

export class Cert implements ICert {
  readonly #class = Cert

  static types = {
    ED_TO_SIGN: 4,
    SIGN_TO_TLS: 5,
    SIGN_TO_AUTH: 6,
  }

  static flags = {
    AFFECTS_VALIDATION: 1
  }

  constructor(
    readonly type: number,
    readonly version: number,
    readonly certType: number,
    readonly expiration: Date,
    readonly certKeyType: number,
    readonly certKey: Uint8Array,
    readonly extensions: Extensions,
    readonly payload: Uint8Array,
    readonly signature: Uint8Array
  ) { }

  write(cursor: Cursor) {
    throw new Error(`Unimplemented`)
  }

  check() {
    const now = new Date()

    if (now > this.expiration)
      throw new Error(`Late certificate`)
    if (this.extensions.signer)
      this.extensions.signer.check(this)
  }

  static read(cursor: Cursor, type: number, length: number) {
    const start = cursor.offset

    const version = cursor.readUint8()
    const certType = cursor.readUint8()

    const expDateHours = cursor.readUint32()
    const expiration = new Date(expDateHours * 60 * 60 * 1000)

    const certKeyType = cursor.readUint8()
    const certKey = cursor.read(32)

    const nextensions = cursor.readUint8()
    const extensions: Extensions = {}

    for (let i = 0; i < nextensions; i++) {
      const length = cursor.readUint16()
      const type = cursor.readUint8()
      const flags = cursor.readUint8()

      if (type === SignedWithEd25519Key.type) {
        extensions.signer = SignedWithEd25519Key.read(cursor, length, flags)
        continue
      }

      if (flags === this.flags.AFFECTS_VALIDATION)
        throw new Error(`Unknown Ed25519 cert extension type ${type}`)
      else
        cursor.read(length)
    }

    const content = cursor.offset - start
    cursor.offset = start
    const payload = cursor.read(content)

    const signature = cursor.read(64)

    if (cursor.offset - start !== length)
      throw new Error(`Invalid Ed25519 cert length ${length}`)
    return new this(type, version, certType, expiration, certKeyType, certKey, extensions, payload, signature)
  }

}