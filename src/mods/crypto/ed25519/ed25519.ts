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

