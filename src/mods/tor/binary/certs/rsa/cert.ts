import { ASN1Error, DERReadError } from "@hazae41/asn1";
import { BinaryWriteError } from "@hazae41/binary";
import { Bytes } from "@hazae41/bytes";
import { Cursor } from "@hazae41/cursor";
import { Err, Ok, Result } from "@hazae41/result";
import { X509 } from "@hazae41/x509";

export class ExpiredCertError extends Error {
  readonly #class = ExpiredCertError
  readonly name = this.#class.name

  constructor() {
    super(`Expired certificate`)
  }

}

export class PrematureCertError extends Error {
  readonly #class = PrematureCertError
  readonly name = this.#class.name

  constructor() {
    super(`Premature certificate`)
  }

}

export class RsaCert {
  readonly #class = RsaCert

  static types = {
    RSA_SELF: 2,
    RSA_TO_TLS: 1,
    RSA_TO_AUTH: 3
  }

  constructor(
    readonly type: number,
    readonly bytes: Bytes,
    readonly x509: X509.Certificate
  ) { }

  async tryHash(): Promise<Result<Bytes, BinaryWriteError>> {
    return await Result.unthrow(async t => {
      const key = X509.tryWriteToBytes(this.x509.tbsCertificate.subjectPublicKeyInfo).throw(t)
      const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", key))

      return new Ok(hash)
    })
  }

  tryVerify(): Result<void, ExpiredCertError | PrematureCertError> {
    const now = new Date()

    if (now > this.x509.tbsCertificate.validity.notAfter.value)
      return new Err(new ExpiredCertError())
    if (now < this.x509.tbsCertificate.validity.notBefore.value)
      return new Err(new PrematureCertError())

    return Ok.void()
  }

  trySize(): Result<number, never> {
    return new Ok(1 + 2 + this.bytes.length)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return Result.unthrowSync(t => {
      cursor.tryWriteUint8(this.type).throw(t)
      cursor.tryWriteUint16(this.bytes.length).throw(t)
      cursor.tryWrite(this.bytes).throw(t)

      return Ok.void()
    })
  }

  static tryRead(cursor: Cursor, type: number, length: number): Result<RsaCert, DERReadError | ASN1Error> {
    return Result.unthrowSync(t => {
      const start = cursor.offset

      const data = cursor.tryRead(length).throw(t)
      const x509 = X509.tryReadFromBytes(X509.Certificate, data).throw(t)

      if (cursor.offset - start !== length)
        throw new Error(`Invalid RSA cert length ${length}`)
      return new Ok(new this(type, data, x509))
    })
  }

}