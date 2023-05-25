import { Cursor } from "@hazae41/cursor";
import { Ed25519 } from "@hazae41/ed25519";
import { Err, Ok, Result } from "@hazae41/result";
import { InvalidSignatureError } from "index.js";
import { SignedWithEd25519Key } from "mods/tor/binary/certs/ed25519/extensions/signer.js";
import { ExpiredCertError } from "../index.js";

export interface Extensions {
  signer?: SignedWithEd25519Key
}

export class Ed25519Cert {
  readonly #class = Ed25519Cert

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

  tryVerify(ed25519: Ed25519.Adapter): Result<void, ExpiredCertError | InvalidSignatureError> {
    const now = new Date()

    if (now > this.expiration)
      return new Err(new ExpiredCertError())

    if (!this.extensions.signer)
      return Ok.void()

    const { PublicKey, Signature } = ed25519

    const signer = new PublicKey(this.extensions.signer.key)
    const signature = new Signature(this.signature)
    const verified = signer.verify(this.payload, signature)

    if (!verified)
      return new Err(new InvalidSignatureError())

    return Ok.void()
  }

  static tryRead(cursor: Cursor, type: number, length: number) {
    return Result.unthrowSync(t => {
      const start = cursor.offset

      const version = cursor.tryReadUint8().throw(t)
      const certType = cursor.tryReadUint8().throw(t)

      const expDateHours = cursor.tryReadUint32().throw(t)
      const expiration = new Date(expDateHours * 60 * 60 * 1000)

      const certKeyType = cursor.tryReadUint8().throw(t)
      const certKey = cursor.tryRead(32).throw(t)

      const nextensions = cursor.tryReadUint8().throw(t)
      const extensions: Extensions = {}

      for (let i = 0; i < nextensions; i++) {
        const length = cursor.tryReadUint16().throw(t)
        const type = cursor.tryReadUint8().throw(t)
        const flags = cursor.tryReadUint8().throw(t)

        if (type === SignedWithEd25519Key.type) {
          extensions.signer = SignedWithEd25519Key.read(cursor, length, flags)
          continue
        }

        if (flags === this.flags.AFFECTS_VALIDATION)
          throw new Error(`Unknown Ed25519 cert extension type ${type}`)
        else
          cursor.tryRead(length).throw(t)
      }

      const content = cursor.offset - start
      cursor.offset = start
      const payload = cursor.tryRead(content).throw(t)

      const signature = cursor.tryRead(64).throw(t)

      if (cursor.offset - start !== length)
        throw new Error(`Invalid Ed25519 cert length ${length}`)

      return new Ok(new this(type, version, certType, expiration, certKeyType, certKey, extensions, payload, signature))
    })
  }

}