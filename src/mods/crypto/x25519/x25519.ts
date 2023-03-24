import { Berith } from "@hazae41/berith"
import { x25519 } from "@noble/curves/ed25519"

export namespace X25519 {

  export interface PublicKey {
    to_bytes(): Uint8Array
  }

  export interface SharedSecret {
    to_bytes(): Uint8Array
  }

  export interface StaticSecret {
    to_public(): PublicKey
    diffie_hellman(public_key: PublicKey): SharedSecret
  }

  export type StaticSecretClass = new () => StaticSecret
  export type PublicKeyClass = new (bytes: Uint8Array) => PublicKey

  export interface Adapter {
    StaticSecret: StaticSecretClass
    PublicKey: PublicKeyClass
  }

  export function fromBerith(berith: typeof Berith): Adapter {
    const PublicKey = berith.X25519PublicKey
    const StaticSecret = berith.X25519StaticSecret

    return { PublicKey, StaticSecret }
  }

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
      readonly bytes = x25519.utils.randomPrivateKey()

      to_public() {
        return new PublicKey(noble.getPublicKey(this.bytes))
      }

      diffie_hellman(public_key: PublicKey) {
        return new SharedSecret(noble.getSharedSecret(this.bytes, public_key.bytes))
      }
    }

    return { PublicKey, StaticSecret }
  }

}
