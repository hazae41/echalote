import type { x25519 } from "@noble/curves/ed25519"
import { Adapter } from "./x25519.js"

export function fromNoble(noble: typeof x25519): Adapter {

  class PublicKey {
    constructor(
      readonly bytes: Uint8Array
    ) { }

    to_bytes() {
      return this.bytes
    }
  }

  class SharedSecret {
    constructor(
      readonly bytes: Uint8Array
    ) { }

    to_bytes() {
      return this.bytes
    }
  }

  class StaticSecret {
    readonly bytes = noble.utils.randomPrivateKey()

    to_public() {
      return new PublicKey(noble.getPublicKey(this.bytes))
    }

    diffie_hellman(public_key: PublicKey) {
      return new SharedSecret(noble.getSharedSecret(this.bytes, public_key.bytes))
    }
  }

  return { PublicKey, StaticSecret }
}