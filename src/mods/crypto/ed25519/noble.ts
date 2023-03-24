import type { ed25519 } from "@noble/curves/ed25519"
import { Adapter } from "./ed25519.js"

export function fromNoble(noble: typeof ed25519): Adapter {

  class Signature {
    constructor(
      readonly bytes: Uint8Array
    ) { }
  }

  class PublicKey {
    constructor(
      readonly bytes: Uint8Array
    ) { }

    verify(payload: Uint8Array, signature: Signature) {
      return noble.verify(signature.bytes, payload, this.bytes)
    }
  }

  return { PublicKey, Signature }
}