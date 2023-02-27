import { Ed25519PublicKey, Ed25519Signature } from "@hazae41/berith"
import { Cursor, Opaque } from "@hazae41/binary"
import { Bytes } from "@hazae41/bytes"
import { RsaPublicKey } from "@hazae41/paimon"
import { Cell } from "mods/tor/binary/cells/cell.js"
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js"
import { Duplicated } from "mods/tor/binary/certs/errors.js"
import { Cross, Ed25519, RSA } from "mods/tor/binary/certs/index.js"

export interface CertsObject {
  rsa_self?: RSA.Cert,
  rsa_to_tls?: RSA.Cert,
  rsa_to_auth?: RSA.Cert,
  rsa_to_ed?: Cross.Cert
  ed_to_sign?: Ed25519.Cert,
  sign_to_tls?: Ed25519.Cert,
  sign_to_auth?: Ed25519.Cert,
}

export class CertsCell {
  readonly #class = CertsCell

  static command = 129

  constructor(
    readonly circuit: undefined,
    readonly certs: CertsObject
  ) { }

  get command() {
    return this.#class.command
  }

  async getIdHash() {
    if (!this.certs.rsa_self)
      throw new Error(`Undefined ID cert`)

    const key = this.certs.rsa_self.x509.tbsCertificate.subjectPublicKeyInfo.toBytes()
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", key))

    return hash
  }

  async checkId() {
    if (!this.certs.rsa_self)
      throw new Error(`Undefined ID cert`)
    this.certs.rsa_self.check()

    const signed = this.certs.rsa_self.x509.tbsCertificate.toBytes()
    const publicKey = this.certs.rsa_self.x509.tbsCertificate.subjectPublicKeyInfo.toBytes()
    const signatureAlgorithm = { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } }
    const signature = this.certs.rsa_self.x509.signatureValue.bytes

    const key = await crypto.subtle.importKey("spki", publicKey, signatureAlgorithm, true, ["verify"]);
    const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signed)
    if (!verified) throw new Error(`Invalid signature for ID cert`)
  }

  async checkIdToTls() {
    if (!this.certs.rsa_self)
      throw new Error(`Undefined ID cert`)
    if (!this.certs.rsa_to_tls)
      throw new Error(`Undefined ID_TO_TLS cert`)
    this.certs.rsa_to_tls.check()

    const signed = this.certs.rsa_to_tls.x509.tbsCertificate.toBytes()
    const publicKey = this.certs.rsa_self.x509.tbsCertificate.subjectPublicKeyInfo.toBytes()
    const signatureAlgorithm = { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } }
    const signature = this.certs.rsa_to_tls.x509.signatureValue.bytes

    const key = await crypto.subtle.importKey("spki", publicKey, signatureAlgorithm, true, ["verify"]);
    const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signed)
    if (!verified) throw new Error(`Invalid signature for ID_TO_TLS cert`)

    console.warn("Could not verify ID_TO_TLS cert key")
  }

  async checkIdToEid() {
    if (!this.certs.rsa_self)
      throw new Error(`Undefined ID cert`)
    if (!this.certs.rsa_to_ed)
      throw new Error(`Undefined ID_TO_EID cert`)
    this.certs.rsa_to_ed.check()

    const publicKey = this.certs.rsa_self.x509.tbsCertificate.subjectPublicKeyInfo.toBytes()
    const identity = RsaPublicKey.from_public_key_der(publicKey)

    const prefix = Bytes.fromUtf8("Tor TLS RSA/Ed25519 cross-certificate")
    const prefixed = Bytes.concat([prefix, this.certs.rsa_to_ed.payload])
    const hashed = new Uint8Array(await crypto.subtle.digest("SHA-256", prefixed))

    const verified = identity.verify_pkcs1v15_raw(hashed, this.certs.rsa_to_ed.signature)
    if (!verified) throw new Error(`Invalid signature for ID_TO_EID cert`)
  }

  checkEidToSigning() {
    if (!this.certs.rsa_to_ed)
      throw new Error(`Undefined ID_TO_EID cert`)
    if (!this.certs.ed_to_sign)
      throw new Error(`Undefined EID_TO_SIGNING cert`)
    this.certs.ed_to_sign.check()

    const identity = new Ed25519PublicKey(this.certs.rsa_to_ed.key)
    const signature = new Ed25519Signature(this.certs.ed_to_sign.signature)
    const verified = identity.verify(this.certs.ed_to_sign.payload, signature)
    if (!verified) throw new Error(`Invalid signature for EID_TO_SIGNING cert`)
  }

  checkSigningToTls() {
    if (!this.certs.ed_to_sign)
      throw new Error(`Undefined EID_TO_SIGNING cert`)
    if (!this.certs.sign_to_tls)
      throw new Error(`Undefined SIGNING_TO_TLS cert`)
    this.certs.sign_to_tls.check()

    const identity = new Ed25519PublicKey(this.certs.ed_to_sign.certKey)
    const signature = new Ed25519Signature(this.certs.sign_to_tls.signature)
    const verified = identity.verify(this.certs.sign_to_tls.payload, signature)
    if (!verified) throw new Error(`Invalid signature for SIGNING_TO_TLS cert`)

    console.warn("Could not verify SIGNING_TO_TLS cert key")
  }

  static read(cursor: Cursor) {
    const ncerts = cursor.readUint8()
    const certs: CertsObject = {}

    for (let i = 0; i < ncerts; i++) {
      const type = cursor.readUint8()
      const length = cursor.readUint16()

      if (type === RSA.Cert.types.RSA_SELF) {
        if (certs.rsa_self) throw new Duplicated(type)
        certs.rsa_self = RSA.Cert.read(cursor, type, length)
        continue
      }

      if (type === RSA.Cert.types.RSA_TO_AUTH) {
        if (certs.rsa_to_auth) throw new Duplicated(type)
        certs.rsa_to_auth = RSA.Cert.read(cursor, type, length)
        continue
      }

      if (type === RSA.Cert.types.RSA_TO_TLS) {
        if (certs.rsa_to_tls) throw new Duplicated(type)
        certs.rsa_to_tls = RSA.Cert.read(cursor, type, length)
        continue
      }

      if (type === Cross.Cert.types.RSA_TO_ED) {
        if (certs.rsa_to_ed) throw new Duplicated(type)
        certs.rsa_to_ed = Cross.Cert.read(cursor, type, length)
        continue
      }

      if (type === Ed25519.Cert.types.ED_TO_SIGN) {
        if (certs.ed_to_sign) throw new Duplicated(type)
        certs.ed_to_sign = Ed25519.Cert.read(cursor, type, length)
        continue
      }

      if (type === Ed25519.Cert.types.SIGN_TO_TLS) {
        if (certs.sign_to_tls) throw new Duplicated(type)
        certs.sign_to_tls = Ed25519.Cert.read(cursor, type, length)
        continue
      }

      if (type === Ed25519.Cert.types.SIGN_TO_AUTH) {
        if (certs.sign_to_auth) throw new Duplicated(type)
        certs.sign_to_auth = Ed25519.Cert.read(cursor, type, length)
        continue
      }

      throw new Error(`Unknown CERTS cell cert type ${type}`)
    }

    return { certs }
  }

  static uncell(cell: Cell<Opaque>) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    const { certs } = cell.payload.into(this)
    return new this(cell.circuit, certs)
  }

}