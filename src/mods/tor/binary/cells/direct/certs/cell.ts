import { Ed25519PublicKey, Ed25519Signature } from "@hazae41/berith"
import { Cursor, Opaque } from "@hazae41/binary"
import { Bytes } from "@hazae41/bytes"
import { RsaPublicKey } from "@hazae41/paimon"
import { Cell } from "mods/tor/binary/cells/cell.js"
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js"
import { Duplicated } from "mods/tor/binary/certs/errors.js"
import { Cross, Ed25519, RSA } from "mods/tor/binary/certs/index.js"

export interface Certs {
  id?: RSA.Cert,
  id_to_tls?: RSA.Cert,
  id_to_auth?: RSA.Cert,
  id_to_eid?: Cross.Cert
  eid_to_signing?: Ed25519.Cert,
  signing_to_tls?: Ed25519.Cert,
  signing_to_auth?: Ed25519.Cert,
}

export class CertsCell {
  readonly #class = CertsCell

  static command = 129

  constructor(
    readonly circuit: undefined,
    readonly certs: Certs
  ) { }

  get command() {
    return this.#class.command
  }

  async getIdHash() {
    if (!this.certs.id)
      throw new Error(`Undefined ID cert`)

    const key = this.certs.id.x509.tbsCertificate.subjectPublicKeyInfo.toBytes()
    const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", key))

    return hash
  }

  async checkId() {
    if (!this.certs.id)
      throw new Error(`Undefined ID cert`)
    this.certs.id.check()

    const signed = this.certs.id.x509.tbsCertificate.toBytes()
    const publicKey = this.certs.id.x509.tbsCertificate.subjectPublicKeyInfo.toBytes()
    const signatureAlgorithm = { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } }
    const signature = this.certs.id.x509.signatureValue.bytes

    const key = await crypto.subtle.importKey("spki", publicKey, signatureAlgorithm, true, ["verify"]);
    const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signed)
    if (!verified) throw new Error(`Invalid signature for ID cert`)
  }

  async checkIdToTls() {
    if (!this.certs.id)
      throw new Error(`Undefined ID cert`)
    if (!this.certs.id_to_tls)
      throw new Error(`Undefined ID_TO_TLS cert`)
    this.certs.id_to_tls.check()

    const signed = this.certs.id_to_tls.x509.tbsCertificate.toBytes()
    const publicKey = this.certs.id.x509.tbsCertificate.subjectPublicKeyInfo.toBytes()
    const signatureAlgorithm = { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } }
    const signature = this.certs.id_to_tls.x509.signatureValue.bytes

    const key = await crypto.subtle.importKey("spki", publicKey, signatureAlgorithm, true, ["verify"]);
    const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, signed)
    if (!verified) throw new Error(`Invalid signature for ID_TO_TLS cert`)

    console.warn("Could not verify ID_TO_TLS cert key")
  }

  async checkIdToEid() {
    if (!this.certs.id)
      throw new Error(`Undefined ID cert`)
    if (!this.certs.id_to_eid)
      throw new Error(`Undefined ID_TO_EID cert`)
    this.certs.id_to_eid.check()

    const publicKey = this.certs.id.x509.tbsCertificate.subjectPublicKeyInfo.toBytes()
    const identity = RsaPublicKey.from_public_key_der(publicKey)

    const prefix = Bytes.fromUtf8("Tor TLS RSA/Ed25519 cross-certificate")
    const prefixed = Bytes.concat([prefix, this.certs.id_to_eid.payload])
    const hashed = new Uint8Array(await crypto.subtle.digest("SHA-256", prefixed))

    const verified = identity.verify_pkcs1v15_raw(hashed, this.certs.id_to_eid.signature)
    if (!verified) throw new Error(`Invalid signature for ID_TO_EID cert`)
  }

  checkEidToSigning() {
    if (!this.certs.id_to_eid)
      throw new Error(`Undefined ID_TO_EID cert`)
    if (!this.certs.eid_to_signing)
      throw new Error(`Undefined EID_TO_SIGNING cert`)
    this.certs.eid_to_signing.check()

    const identity = new Ed25519PublicKey(this.certs.id_to_eid.key)
    const signature = new Ed25519Signature(this.certs.eid_to_signing.signature)
    const verified = identity.verify(this.certs.eid_to_signing.payload, signature)
    if (!verified) throw new Error(`Invalid signature for EID_TO_SIGNING cert`)
  }

  checkSigningToTls() {
    if (!this.certs.eid_to_signing)
      throw new Error(`Undefined EID_TO_SIGNING cert`)
    if (!this.certs.signing_to_tls)
      throw new Error(`Undefined SIGNING_TO_TLS cert`)
    this.certs.signing_to_tls.check()

    const identity = new Ed25519PublicKey(this.certs.eid_to_signing.certKey)
    const signature = new Ed25519Signature(this.certs.signing_to_tls.signature)
    const verified = identity.verify(this.certs.signing_to_tls.payload, signature)
    if (!verified) throw new Error(`Invalid signature for SIGNING_TO_TLS cert`)

    console.warn("Could not verify SIGNING_TO_TLS cert key")
  }

  static uncell(cell: Cell<Opaque>) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    const cursor = new Cursor(cell.payload.bytes)

    const ncerts = cursor.readUint8()
    const certs: Certs = {}

    for (let i = 0; i < ncerts; i++) {
      const type = cursor.readUint8()
      const length = cursor.readUint16()

      if (type === RSA.Cert.types.ID) {
        if (certs.id) throw new Duplicated(type)
        certs.id = RSA.Cert.read(cursor, type, length)
        continue
      }

      if (type === RSA.Cert.types.ID_TO_AUTH) {
        if (certs.id_to_auth) throw new Duplicated(type)
        certs.id_to_auth = RSA.Cert.read(cursor, type, length)
        continue
      }

      if (type === RSA.Cert.types.ID_TO_TLS) {
        if (certs.id_to_tls) throw new Duplicated(type)
        certs.id_to_tls = RSA.Cert.read(cursor, type, length)
        continue
      }

      if (type === Cross.Cert.types.ID_TO_EID) {
        if (certs.id_to_eid) throw new Duplicated(type)
        certs.id_to_eid = Cross.Cert.read(cursor, type, length)
        continue
      }

      if (type === Ed25519.Cert.types.EID_TO_SIGNING) {
        if (certs.eid_to_signing) throw new Duplicated(type)
        certs.eid_to_signing = Ed25519.Cert.read(cursor, type, length)
        continue
      }

      if (type === Ed25519.Cert.types.SIGNING_TO_TLS) {
        if (certs.signing_to_tls) throw new Duplicated(type)
        certs.signing_to_tls = Ed25519.Cert.read(cursor, type, length)
        continue
      }

      if (type === Ed25519.Cert.types.SIGNING_TO_AUTH) {
        if (certs.signing_to_auth) throw new Duplicated(type)
        certs.signing_to_auth = Ed25519.Cert.read(cursor, type, length)
        continue
      }

      throw new Error(`Unknown CERTS cell cert type ${type}`)
    }

    return new this(cell.circuit, certs)
  }

}