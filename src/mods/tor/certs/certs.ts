import { Bytes } from "@hazae41/bytes";
import { RsaPublicKey } from "@hazae41/paimon";
import { CertsObject, Ed25519Cert } from "../index.js";
import { SecretTorClientDuplex } from "../tor.js";

export namespace Certs {

  export async function verify(certs: CertsObject, tor: SecretTorClientDuplex) {
    verifyRsaSelf(certs)
    verifyRsaToTls(certs)
    verifyRsaToEd(certs)
    verifyEdToSigning(certs, tor)
    verifySigningToTls(certs, tor)
  }

  async function verifyRsaSelf(certs: CertsObject) {
    if (!certs.rsa_self)
      throw new Error(`Undefined ID cert`)
    certs.rsa_self.check()

    const signed = certs.rsa_self.x509.tbsCertificate.toBytes()
    const publicKey = certs.rsa_self.x509.tbsCertificate.subjectPublicKeyInfo.toBytes()
    const signatureAlgorithm = { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } }
    const signature = certs.rsa_self.x509.signatureValue.bytes

    const key = await crypto.subtle.importKey("spki", publicKey, signatureAlgorithm, true, ["verify"]);
    const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signed)
    if (!verified) throw new Error(`Invalid signature for ID cert`)
  }

  async function verifyRsaToTls(certs: CertsObject) {
    if (!certs.rsa_self)
      throw new Error(`Undefined ID cert`)
    if (!certs.rsa_to_tls)
      throw new Error(`Undefined ID_TO_TLS cert`)
    certs.rsa_to_tls.check()

    const signed = certs.rsa_to_tls.x509.tbsCertificate.toBytes()
    const publicKey = certs.rsa_self.x509.tbsCertificate.subjectPublicKeyInfo.toBytes()
    const signatureAlgorithm = { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } }
    const signature = certs.rsa_to_tls.x509.signatureValue.bytes

    const key = await crypto.subtle.importKey("spki", publicKey, signatureAlgorithm, true, ["verify"]);
    const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signed)
    if (!verified) throw new Error(`Invalid signature for ID_TO_TLS cert`)

    console.warn("Could not verify ID_TO_TLS cert key")
  }

  async function verifyRsaToEd(certs: CertsObject) {
    if (!certs.rsa_self)
      throw new Error(`Undefined ID cert`)
    if (!certs.rsa_to_ed)
      throw new Error(`Undefined ID_TO_EID cert`)
    certs.rsa_to_ed.check()

    const publicKey = certs.rsa_self.x509.tbsCertificate.subjectPublicKeyInfo.toBytes()
    const identity = RsaPublicKey.from_public_key_der(publicKey)

    const prefix = Bytes.fromUtf8("Tor TLS RSA/Ed25519 cross-certificate")
    const prefixed = Bytes.concat([prefix, certs.rsa_to_ed.payload])
    const hashed = new Uint8Array(await crypto.subtle.digest("SHA-256", prefixed))

    const verified = identity.verify_pkcs1v15_raw(hashed, certs.rsa_to_ed.signature)
    if (!verified) throw new Error(`Invalid signature for ID_TO_EID cert`)
  }

  export function verifyGenericEd25519(cert: Ed25519Cert, tor: SecretTorClientDuplex) {
    const { PublicKey, Signature } = tor.params.ed25519

    const now = new Date()

    if (now > cert.expiration)
      throw new Error(`Certificate expired`)

    if (cert.extensions.signer) {
      const signer = new PublicKey(cert.extensions.signer.key)
      const signature = new Signature(cert.signature)
      const verified = signer.verify(cert.payload, signature)
      if (!verified) throw new Error(`Invalid signature`)
    }
  }

  function verifyEdToSigning(certs: CertsObject, tor: SecretTorClientDuplex) {
    const { PublicKey, Signature } = tor.params.ed25519

    if (!certs.rsa_to_ed)
      throw new Error(`Undefined ID_TO_EID cert`)
    if (!certs.ed_to_sign)
      throw new Error(`Undefined EID_TO_SIGNING cert`)

    verifyGenericEd25519(certs.ed_to_sign, tor)

    const identity = new PublicKey(certs.rsa_to_ed.key)
    const signature = new Signature(certs.ed_to_sign.signature)
    const verified = identity.verify(certs.ed_to_sign.payload, signature)
    if (!verified) throw new Error(`Invalid signature for EID_TO_SIGNING cert`)
  }

  function verifySigningToTls(certs: CertsObject, tor: SecretTorClientDuplex) {
    const { PublicKey, Signature } = tor.params.ed25519

    if (!certs.ed_to_sign)
      throw new Error(`Undefined EID_TO_SIGNING cert`)
    if (!certs.sign_to_tls)
      throw new Error(`Undefined SIGNING_TO_TLS cert`)

    verifyGenericEd25519(certs.sign_to_tls, tor)

    const identity = new PublicKey(certs.ed_to_sign.certKey)
    const signature = new Signature(certs.sign_to_tls.signature)
    const verified = identity.verify(certs.sign_to_tls.payload, signature)
    if (!verified) throw new Error(`Invalid signature for SIGNING_TO_TLS cert`)

    console.warn("Could not verify SIGNING_TO_TLS cert key")
  }

}