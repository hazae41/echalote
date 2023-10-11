import { BinaryReadError } from "@hazae41/binary";
import { Box, Copied } from "@hazae41/box";
import { Bytes } from "@hazae41/bytes";
import { Cursor } from "@hazae41/cursor";
import { Ed25519 } from "@hazae41/ed25519";
import { Err, Ok, Result } from "@hazae41/result";
import { CryptoError } from "libs/crypto/crypto.js";
import { SignedWithEd25519Key } from "mods/tor/binary/certs/ed25519/extensions/signer.js";
import { ExpiredCertError, InvalidSignatureError } from "mods/tor/certs/certs.js";

export interface Extensions {
  signer?: SignedWithEd25519Key
}

export class UnknownCertExtensionError extends Error {
  readonly #class = UnknownCertExtensionError
  readonly name = this.#class.name

  constructor(
    readonly type: number
  ) {
    super(`Unknown certificate extension ${type}`)
  }

}

export class Ed25519Cert {
  readonly #class = Ed25519Cert

  static readonly types = {
    ED_TO_SIGN: 4,
    SIGN_TO_TLS: 5,
    SIGN_TO_AUTH: 6,
  } as const

  static readonly flags = {
    AFFECTS_VALIDATION: 1
  } as const

  constructor(
    readonly type: number,
    readonly version: number,
    readonly certType: number,
    readonly expiration: Date,
    readonly certKeyType: number,
    readonly certKey: Bytes<32>,
    readonly extensions: Extensions,
    readonly payload: Uint8Array,
    readonly signature: Bytes<64>
  ) { }

  async tryVerify(ed25519: Ed25519.Adapter): Promise<Result<void, CryptoError | ExpiredCertError | InvalidSignatureError>> {
    return await Result.unthrow(async t => {
      const now = new Date()

      if (now > this.expiration)
        return new Err(new ExpiredCertError())

      if (!this.extensions.signer)
        return Ok.void()

      const { PublicKey, Signature } = ed25519

      using signer = await PublicKey
        .tryImport(new Box(new Copied(this.extensions.signer.key)))
        .then(r => r.mapErrSync(CryptoError.from).throw(t))

      using signature = Signature
        .tryImport(new Box(new Copied(this.signature)))
        .mapErrSync(CryptoError.from).throw(t)

      const verified = await signer
        .tryVerify(new Box(new Copied(this.payload)), signature)
        .then(r => r.mapErrSync(CryptoError.from).throw(t))

      if (verified !== true)
        return new Err(new InvalidSignatureError())

      return Ok.void()
    })
  }

  static tryRead(cursor: Cursor): Result<Ed25519Cert, BinaryReadError | UnknownCertExtensionError> {
    return Result.unthrowSync(t => {
      const type = cursor.tryReadUint8().throw(t)
      const length = cursor.tryReadUint16().throw(t)

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
          extensions.signer = SignedWithEd25519Key.tryRead(cursor).throw(t)
          continue
        }

        if (flags === this.flags.AFFECTS_VALIDATION)
          return new Err(new UnknownCertExtensionError(type))
        else
          cursor.tryRead(length).throw(t)
      }

      const content = cursor.offset - start

      cursor.offset = start

      const payload = cursor.tryRead(content).throw(t)

      const signature = cursor.tryRead(64).throw(t)

      return new Ok(new Ed25519Cert(type, version, certType, expiration, certKeyType, certKey, extensions, payload, signature))
    })
  }

}