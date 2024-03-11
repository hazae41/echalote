import { Readable } from "@hazae41/binary"
import { Cursor } from "@hazae41/cursor"
import { Mutable } from "libs/typescript/typescript.js"
import { CrossCert } from "mods/tor/binary/certs/cross/cert.js"
import { Ed25519Cert } from "mods/tor/binary/certs/ed25519/cert.js"
import { RsaCert } from "mods/tor/binary/certs/rsa/cert.js"
import { Certs, DuplicatedCertError, UnknownCertError } from "mods/tor/certs/certs.js"
import { Unimplemented } from "mods/tor/errors.js"

export class CertsCell {
  readonly #class = CertsCell

  static readonly old = false
  static readonly circuit = false
  static readonly command = 129

  constructor(
    readonly certs: Partial<Certs>
  ) { }

  get circuit(): false {
    return this.#class.circuit
  }

  get command(): 129 {
    return this.#class.command
  }

  sizeOrThrow(): never {
    throw new Unimplemented()
  }

  writeOrThrow(cursor: Cursor): never {
    throw new Unimplemented()
  }

  static readOrThrow(cursor: Cursor) {
    const certs: Partial<Mutable<Certs>> = {}

    const count = cursor.readUint8OrThrow()

    for (let i = 0; i < count; i++) {
      const offset = cursor.offset

      const type = cursor.readUint8OrThrow()
      const length = cursor.readUint16OrThrow()

      cursor.offset = offset

      const bytes = cursor.readOrThrow(1 + 2 + length)

      if (type === RsaCert.types.RSA_SELF) {
        if (certs.rsa_self != null)
          throw new DuplicatedCertError()

        certs.rsa_self = Readable.readFromBytesOrThrow(RsaCert, bytes)
        continue
      }

      if (type === RsaCert.types.RSA_TO_AUTH) {
        if (certs.rsa_to_auth != null)
          throw new DuplicatedCertError()

        certs.rsa_to_auth = Readable.readFromBytesOrThrow(RsaCert, bytes)
        continue
      }

      if (type === RsaCert.types.RSA_TO_TLS) {
        if (certs.rsa_to_tls != null)
          throw new DuplicatedCertError()

        certs.rsa_to_tls = Readable.readFromBytesOrThrow(RsaCert, bytes)
        continue
      }

      if (type === CrossCert.types.RSA_TO_ED) {
        if (certs.rsa_to_ed != null)
          throw new DuplicatedCertError()

        certs.rsa_to_ed = Readable.readFromBytesOrThrow(CrossCert, bytes)
        continue
      }

      if (type === Ed25519Cert.types.ED_TO_SIGN) {
        if (certs.ed_to_sign != null)
          throw new DuplicatedCertError()

        certs.ed_to_sign = Readable.readFromBytesOrThrow(Ed25519Cert, bytes)
        continue
      }

      if (type === Ed25519Cert.types.SIGN_TO_TLS) {
        if (certs.sign_to_tls != null)
          throw new DuplicatedCertError()

        certs.sign_to_tls = Readable.readFromBytesOrThrow(Ed25519Cert, bytes)
        continue
      }

      if (type === Ed25519Cert.types.SIGN_TO_AUTH) {
        if (certs.sign_to_auth != null)
          throw new DuplicatedCertError()

        certs.sign_to_auth = Readable.readFromBytesOrThrow(Ed25519Cert, bytes)
        continue
      }

      throw new UnknownCertError()
    }

    return new CertsCell(certs)
  }

}