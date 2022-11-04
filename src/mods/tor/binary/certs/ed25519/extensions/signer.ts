import { Ed25519PublicKey, Ed25519Signature } from "@hazae41/berith";
import { Binary } from "libs/binary.js";
import { Cert } from "mods/tor/binary/certs/ed25519/cert.js";
import { Extension } from "mods/tor/binary/certs/ed25519/extensions/extension.js";

export class SignedWithEd25519Key implements Extension {
  readonly class = SignedWithEd25519Key

  static type = 4

  constructor(
    readonly length: number,
    readonly flags: number,
    readonly key: Buffer
  ) { }

  get type() {
    return this.class.type
  }

  check(cert: Cert) {
    const identity = new Ed25519PublicKey(this.key)
    const signature = new Ed25519Signature(cert.signature)
    const verified = identity.verify(cert.payload, signature)
    if (!verified) throw new Error(`Invalid signer for Ed25519 Cert`)
  }

  write(binary: Binary) {
    throw new Error(`Unimplemented`)
  }

  static read(binary: Binary, length: number, flags: number) {
    const start = binary.offset

    const key = binary.read(32)

    if (binary.offset - start !== length)
      throw new Error(`Invalid Ed25519 cert extension SignedWithEd25519Key length ${length}`)
    return new this(length, flags, key)
  }
}