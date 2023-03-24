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

