import { Uint8Array } from "@hazae41/bytes"
import { Cursor } from "@hazae41/cursor"
import { HASH_LEN, KEY_LEN } from "mods/tor/constants.js"

export class InvalidKdfKeyHashError extends Error {
  readonly #class = InvalidKdfKeyHashError
  readonly name = this.#class.name

  constructor() {
    super(`Invalid KDF key hash`)
  }

}

export interface KDFTorResult {
  readonly keyHash: Uint8Array<HASH_LEN>,
  readonly forwardDigest: Uint8Array<HASH_LEN>,
  readonly backwardDigest: Uint8Array<HASH_LEN>,
  readonly forwardKey: Uint8Array<KEY_LEN>,
  readonly backwardKey: Uint8Array<KEY_LEN>
}

export namespace KDFTorResult {

  export async function computeOrThrow(k0: Uint8Array): Promise<KDFTorResult> {
    const ki = new Cursor(new Uint8Array(k0.length + 1))
    ki.writeOrThrow(k0)

    const k = new Cursor(new Uint8Array(HASH_LEN * 5))

    for (let i = 0; k.remaining > 0; i++) {
      ki.setUint8OrThrow(i)

      const h = new Uint8Array(await crypto.subtle.digest("SHA-1", ki.bytes))

      k.writeOrThrow(h)
    }

    k.offset = 0

    const keyHash = k.readAndCopyOrThrow(HASH_LEN)
    const forwardDigest = k.readAndCopyOrThrow(HASH_LEN)
    const backwardDigest = k.readAndCopyOrThrow(HASH_LEN)
    const forwardKey = k.readAndCopyOrThrow(KEY_LEN)
    const backwardKey = k.readAndCopyOrThrow(KEY_LEN)

    return { keyHash, forwardDigest, backwardDigest, forwardKey, backwardKey }
  }

}

