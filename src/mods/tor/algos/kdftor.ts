import { Binary } from "@hazae41/binary"
import { HASH_LEN, KEY_LEN } from "mods/tor/constants.js"

export interface KDFResult {
  keyHash: Uint8Array,
  forwardDigest: Uint8Array,
  backwardDigest: Uint8Array,
  forwardKey: Uint8Array,
  backwardKey: Uint8Array
}

export async function kdftor(k0: Buffer): Promise<KDFResult> {
  const ki = Binary.allocUnsafe(k0.length + 1)
  ki.write(k0)

  const k = Binary.allocUnsafe(HASH_LEN * 5)

  for (let i = 0; k.remaining > 0; i++) {
    ki.setUint8(i)
    const h = await crypto.subtle.digest("SHA-1", ki.buffer)
    k.write(Buffer.from(h))
  }

  k.offset = 0

  const keyHash = k.read(HASH_LEN)
  const forwardDigest = k.read(HASH_LEN)
  const backwardDigest = k.read(HASH_LEN)
  const forwardKey = k.read(KEY_LEN)
  const backwardKey = k.read(KEY_LEN)

  return { keyHash, forwardDigest, backwardDigest, forwardKey, backwardKey }
}