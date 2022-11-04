import { Binary } from "libs/binary.js"
import { HASH_LEN, KEY_LEN } from "mods/tor/constants.js"

export interface KDFResult {
  keyHash: Buffer,
  forwardDigest: Buffer,
  backwardDigest: Buffer,
  forwardKey: Buffer,
  backwardKey: Buffer
}

export async function kdftor(k0: Buffer): Promise<KDFResult> {
  const ki = Binary.allocUnsafe(k0.length + 1)
  ki.write(k0)

  const k = Binary.allocUnsafe(HASH_LEN * 5)

  for (let i = 0; k.remaining > 0; i++) {
    ki.writeUint8(i, true)
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