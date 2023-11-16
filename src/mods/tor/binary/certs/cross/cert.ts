import { Uint8Array } from "@hazae41/bytes"
import { Cursor } from "@hazae41/cursor"
import { Unimplemented } from "@hazae41/result"
import { ExpiredCertError } from "mods/tor/certs/certs.js"

export class CrossCert {
  readonly #class = CrossCert

  static readonly types = {
    RSA_TO_ED: 7
  } as const

  constructor(
    readonly type: number,
    readonly key: Uint8Array<32>,
    readonly expiration: Date,
    readonly payload: Uint8Array,
    readonly signature: Uint8Array
  ) { }

  verifyOrThrow() {
    const now = new Date()

    if (now > this.expiration)
      throw new ExpiredCertError()

    return true
  }

  sizeOrThrow(): never {
    throw new Unimplemented()
  }

  writeOrThrow(cursor: Cursor): never {
    throw new Unimplemented()
  }

  static readOrThrow(cursor: Cursor) {
    const type = cursor.readUint8OrThrow()
    const length = cursor.readUint16OrThrow() // TODO: check length

    const start = cursor.offset

    const key = cursor.readAndCopyOrThrow(32)

    const expDateHours = cursor.readUint32OrThrow()
    const expiration = new Date(expDateHours * 60 * 60 * 1000)

    const content = cursor.offset - start

    cursor.offset = start

    const payload = cursor.readAndCopyOrThrow(content)

    const sigLength = cursor.readUint8OrThrow()
    const signature = cursor.readAndCopyOrThrow(sigLength)

    return new CrossCert(type, key, expiration, payload, signature)
  }
}