import { BinaryWriteError } from "@hazae41/binary";
import { Bytes } from "@hazae41/bytes";
import { Ed25519 } from "@hazae41/ed25519";
import { RsaPublicKey } from "@hazae41/paimon";
import { Err, Ok, Result } from "@hazae41/result";
import { X509 } from "@hazae41/x509";
import { CrossCert, Ed25519Cert, RsaCert, UnknownCertExtensionError } from "../index.js";

export type CertError =
  | DuplicatedCertError
  | UnknownCertError
  | ExpectedCertError
  | ExpiredCertError
  | PrematureCertError
  | InvalidSignatureError
  | UnknownCertExtensionError

export class DuplicatedCertError extends Error {
  readonly #class = DuplicatedCertError
  readonly name = this.#class.name

  constructor() {
    super(`Duplicated certificate`)
  }

}

export class UnknownCertError extends Error {
  readonly #class = UnknownCertError
  readonly name = this.#class.name

  constructor() {
    super(`Unknown certificate`)
  }

}

export class ExpectedCertError extends Error {
  readonly #class = ExpectedCertError
  readonly name = this.#class.name

  constructor() {
    super(`Expected a certificate`)
  }

}

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

export class InvalidSignatureError extends Error {
  readonly #class = InvalidSignatureError
  readonly name = this.#class.name

  constructor() {
    super(`Invalid certificate signature`)
  }

}

export interface Certs {
  rsa_self: RsaCert,
  rsa_to_tls: RsaCert,
  rsa_to_auth?: RsaCert,
  rsa_to_ed: CrossCert,
  ed_to_sign: Ed25519Cert,
  sign_to_tls: Ed25519Cert,
  sign_to_auth?: Ed25519Cert,
}

export namespace Certs {

  export async function tryVerify(certs: Partial<Certs>, ed25519: Ed25519.Adapter): Promise<Result<Certs, ExpectedCertError | BinaryWriteError | InvalidSignatureError | ExpiredCertError | PrematureCertError>> {
    const { rsa_self, rsa_to_tls, rsa_to_ed, ed_to_sign, sign_to_tls } = certs

    if (!rsa_self)
      return new Err(new ExpectedCertError())
    if (!rsa_to_tls)
      return new Err(new ExpectedCertError())
    if (!rsa_to_ed)
      return new Err(new ExpectedCertError())
    if (!ed_to_sign)
      return new Err(new ExpectedCertError())
    if (!sign_to_tls)
      return new Err(new ExpectedCertError())

    const certs2 = { rsa_self, rsa_to_tls, rsa_to_ed, ed_to_sign, sign_to_tls }

    return Result.all(await Promise.all([
      tryVerifyRsaSelf(certs2),
      tryVerifyRsaToTls(certs2),
      tryVerifyRsaToEd(certs2),
      tryVerifyEdToSigning(certs2, ed25519),
      tryVerifySigningToTls(certs2, ed25519),
    ])).mapSync(() => certs2)
  }

  async function tryVerifyRsaSelf(certs: Certs): Promise<Result<void, ExpiredCertError | PrematureCertError | BinaryWriteError | InvalidSignatureError>> {
    return await Result.unthrow(async t => {
      certs.rsa_self.tryVerify().throw(t)

      const signed = X509.tryWriteToBytes(certs.rsa_self.x509.tbsCertificate).throw(t)
      const publicKey = X509.tryWriteToBytes(certs.rsa_self.x509.tbsCertificate.subjectPublicKeyInfo).throw(t)

      const signatureAlgorithm = { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } }
      const signature = certs.rsa_self.x509.signatureValue.bytes

      const key = await crypto.subtle.importKey("spki", publicKey, signatureAlgorithm, true, ["verify"]);
      const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signed)

      if (!verified)
        return new Err(new InvalidSignatureError())

      return Ok.void()
    })
  }

  async function tryVerifyRsaToTls(certs: Certs): Promise<Result<void, ExpiredCertError | PrematureCertError | BinaryWriteError | InvalidSignatureError>> {
    return await Result.unthrow(async t => {
      certs.rsa_to_tls.tryVerify().throw(t)

      const signed = X509.tryWriteToBytes(certs.rsa_to_tls.x509.tbsCertificate).throw(t)
      const publicKey = X509.tryWriteToBytes(certs.rsa_self.x509.tbsCertificate.subjectPublicKeyInfo).throw(t)

      const signatureAlgorithm = { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } }
      const signature = certs.rsa_to_tls.x509.signatureValue.bytes

      const key = await crypto.subtle.importKey("spki", publicKey, signatureAlgorithm, true, ["verify"])
      const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signed)

      if (!verified)
        return new Err(new InvalidSignatureError())

      console.warn("Could not verify ID_TO_TLS cert key")
      return Ok.void()
    })
  }

  async function tryVerifyRsaToEd(certs: Certs): Promise<Result<void, ExpiredCertError | BinaryWriteError | InvalidSignatureError>> {
    return await Result.unthrow(async t => {
      certs.rsa_to_ed.tryVerify().throw(t)

      const publicKey = X509.tryWriteToBytes(certs.rsa_self.x509.tbsCertificate.subjectPublicKeyInfo).throw(t)
      const identity = RsaPublicKey.from_public_key_der(publicKey)

      const prefix = Bytes.fromUtf8("Tor TLS RSA/Ed25519 cross-certificate")
      const prefixed = Bytes.concat([prefix, certs.rsa_to_ed.payload])
      const hashed = new Uint8Array(await crypto.subtle.digest("SHA-256", prefixed))

      const verified = identity.verify_pkcs1v15_raw(hashed, certs.rsa_to_ed.signature)

      if (!verified)
        return new Err(new InvalidSignatureError())

      return Ok.void()
    })
  }

  async function tryVerifyEdToSigning(certs: Certs, ed25519: Ed25519.Adapter): Promise<Result<void, ExpiredCertError | BinaryWriteError | InvalidSignatureError>> {
    return Result.unthrowSync(t => {
      certs.ed_to_sign.tryVerify(ed25519).throw(t)

      const { PublicKey, Signature } = ed25519

      const identity = new PublicKey(certs.rsa_to_ed.key)
      const signature = new Signature(certs.ed_to_sign.signature)
      const verified = identity.verify(certs.ed_to_sign.payload, signature)

      if (!verified)
        return new Err(new InvalidSignatureError())

      return Ok.void()
    })
  }

  async function tryVerifySigningToTls(certs: Certs, ed25519: Ed25519.Adapter): Promise<Result<void, ExpiredCertError | BinaryWriteError | InvalidSignatureError>> {
    return Result.unthrowSync(t => {
      certs.sign_to_tls.tryVerify(ed25519).throw(t)

      const { PublicKey, Signature } = ed25519

      const identity = new PublicKey(certs.ed_to_sign.certKey)
      const signature = new Signature(certs.sign_to_tls.signature)
      const verified = identity.verify(certs.sign_to_tls.payload, signature)

      if (!verified)
        return new Err(new InvalidSignatureError())

      console.warn("Could not verify SIGNING_TO_TLS cert key")
      return Ok.void()
    })
  }

}