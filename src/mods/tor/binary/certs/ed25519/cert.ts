import { Cursor } from "@hazae41/binary";
import { Cert as ICert } from "mods/tor/binary/certs/cert.js";
import { SignedWithEd25519Key } from "mods/tor/binary/certs/ed25519/extensions/signer.js";

export interface Extensions {
  signer?: SignedWithEd25519Key
}

export class Cert implements ICert {
  readonly #class = Cert

  static types = {
    EID_TO_SIGNING: 4,
    SIGNING_TO_TLS: 5,
    SIGNING_TO_AUTH: 6,
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

  write(binary: Cursor) {
    throw new Error(`Unimplemented`)
  }

  check() {
    const now = new Date()

    if (now > this.expiration)
      throw new Error(`Late certificate`)
    if (this.extensions.signer)
      this.extensions.signer.check(this)
  }

  static read(binary: Cursor, type: number, length: number) {
    const start = binary.offset

    const version = binary.readUint8()
    const certType = binary.readUint8()

    const expDateHours = binary.readUint32()
    const expiration = new Date(expDateHours * 60 * 60 * 1000)

    const certKeyType = binary.readUint8()
    const certKey = binary.read(32)

    const nextensions = binary.readUint8()
    const extensions: Extensions = {}

    for (let i = 0; i < nextensions; i++) {
      const length = binary.readUint16()
      const type = binary.readUint8()
      const flags = binary.readUint8()

      if (type === SignedWithEd25519Key.type) {
        extensions.signer = SignedWithEd25519Key.read(binary, length, flags)
        continue
      }

      if (flags === this.flags.AFFECTS_VALIDATION)
        throw new Error(`Unknown Ed25519 cert extension type ${type}`)
      else
        binary.read(length)
    }

    const payload = binary.reread(start)
    const signature = binary.read(64)

    if (binary.offset - start !== length)
      throw new Error(`Invalid Ed25519 cert length ${length}`)
    return new this(type, version, certType, expiration, certKeyType, certKey, extensions, payload, signature)
  }

}