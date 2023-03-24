import { Berith } from "@hazae41/berith"
import { ed25519 } from "@noble/curves/ed25519"

export namespace Ed25519 {

  export interface Signature { }

  export interface PublicKey {
    verify(payload: Uint8Array, signature: Signature): boolean
  }

  export type PublicKeyClass = new (bytes: Uint8Array) => PublicKey
  export type SignatureClass = new (bytes: Uint8Array) => Signature

  export interface Adapter {
    PublicKey: PublicKeyClass
    Signature: SignatureClass
  }

  export function fromBerith(berith: typeof Berith): Adapter {
    const PublicKey = berith.Ed25519PublicKey
    const Signature = berith.Ed25519Signature

    return { PublicKey, Signature }
  }

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

}
