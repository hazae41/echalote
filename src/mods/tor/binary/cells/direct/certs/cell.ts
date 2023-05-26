import { ASN1Error, DERReadError } from "@hazae41/asn1"
import { Cursor } from "@hazae41/cursor"
import { Err, Ok, Panic, Result, Unimplemented } from "@hazae41/result"
import { CrossCert } from "mods/tor/binary/certs/cross/cert.js"
import { Ed25519Cert } from "mods/tor/binary/certs/ed25519/cert.js"
import { RsaCert } from "mods/tor/binary/certs/rsa/cert.js"
import { Certs, DuplicatedCertError, UnknownCertError } from "mods/tor/certs/certs.js"

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

  trySize(): Result<never, never> {
    throw Panic.from(new Unimplemented())
  }

  tryWrite(cursor: Cursor): Result<never, never> {
    throw Panic.from(new Unimplemented())
  }

  static tryRead(cursor: Cursor): Result<CertsCell, DERReadError | ASN1Error | DuplicatedCertError | UnknownCertError> {
    return Result.unthrowSync(t => {
      const ncerts = cursor.tryReadUint8().throw(t)

      const certs: Partial<Certs> = {}

      for (let i = 0; i < ncerts; i++) {
        const type = cursor.tryReadUint8().throw(t)
        const length = cursor.tryReadUint16().throw(t)

        if (type === RsaCert.types.RSA_SELF) {
          if (certs.rsa_self)
            return new Err(new DuplicatedCertError())

          certs.rsa_self = RsaCert.tryRead(cursor, type, length).throw(t)
          continue
        }

        if (type === RsaCert.types.RSA_TO_AUTH) {
          if (certs.rsa_self)
            return new Err(new DuplicatedCertError())

          certs.rsa_to_auth = RsaCert.tryRead(cursor, type, length).throw(t)
          continue
        }

        if (type === RsaCert.types.RSA_TO_TLS) {
          if (certs.rsa_self)
            return new Err(new DuplicatedCertError())

          certs.rsa_to_tls = RsaCert.tryRead(cursor, type, length).throw(t)
          continue
        }

        if (type === CrossCert.types.RSA_TO_ED) {
          if (certs.rsa_self)
            return new Err(new DuplicatedCertError())

          certs.rsa_to_ed = CrossCert.tryRead(cursor, type, length).throw(t)
          continue
        }

        if (type === Ed25519Cert.types.ED_TO_SIGN) {
          if (certs.rsa_self)
            return new Err(new DuplicatedCertError())

          certs.ed_to_sign = Ed25519Cert.tryRead(cursor, type, length).throw(t)
          continue
        }

        if (type === Ed25519Cert.types.SIGN_TO_TLS) {
          if (certs.rsa_self)
            return new Err(new DuplicatedCertError())

          certs.sign_to_tls = Ed25519Cert.tryRead(cursor, type, length).throw(t)
          continue
        }

        if (type === Ed25519Cert.types.SIGN_TO_AUTH) {
          if (certs.rsa_self)
            return new Err(new DuplicatedCertError())

          certs.sign_to_auth = Ed25519Cert.tryRead(cursor, type, length).throw(t)
          continue
        }

        return new Err(new UnknownCertError())
      }

      return new Ok(new CertsCell(certs))
    })
  }

}