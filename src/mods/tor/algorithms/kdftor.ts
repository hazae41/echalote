import { BinaryError } from "@hazae41/binary"
import { Bytes } from "@hazae41/bytes"
import { Cursor } from "@hazae41/cursor"
import { Ok, Result } from "@hazae41/result"
import { HASH_LEN, KEY_LEN } from "mods/tor/constants.js"

export interface KDFTorResult {
  keyHash: Bytes<HASH_LEN>,
  forwardDigest: Bytes<HASH_LEN>,
  backwardDigest: Bytes<HASH_LEN>,
  forwardKey: Bytes<KEY_LEN>,
  backwardKey: Bytes<KEY_LEN>
}

export namespace KDFTorResult {

  export async function tryCompute(k0: Uint8Array): Promise<Result<KDFTorResult, BinaryError>> {
    return await Result.unthrow(async t => {
      const ki = Cursor.allocUnsafe(k0.length + 1)
      ki.tryWrite(k0).throw(t)

      const k = Cursor.allocUnsafe(HASH_LEN * 5)

      for (let i = 0; k.remaining > 0; i++) {
        ki.trySetUint8(i).throw(t)
        const h = await crypto.subtle.digest("SHA-1", ki.bytes)
        k.tryWrite(new Uint8Array(h)).throw(t)
      }

      k.offset = 0

      const keyHash = k.tryRead(HASH_LEN).throw(t)
      const forwardDigest = k.tryRead(HASH_LEN).throw(t)
      const backwardDigest = k.tryRead(HASH_LEN).throw(t)
      const forwardKey = k.tryRead(KEY_LEN).throw(t)
      const backwardKey = k.tryRead(KEY_LEN).throw(t)

      return new Ok({ keyHash, forwardDigest, backwardDigest, forwardKey, backwardKey })
    })
  }

}

