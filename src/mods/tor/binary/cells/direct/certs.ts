import { Ed25519PublicKey, Ed25519Signature } from "@hazae41/berith"
import { PaddingScheme, RsaPublicKey } from "@hazae41/paimon"
import { Binary } from "libs/binary.js"
import { NewCell } from "mods/tor/binary/cells/cell.js"
import { Cross, Ed25519, RSA } from "mods/tor/binary/certs/index.js"
import { Duplicated } from "mods/tor/errors/duplicated.js"

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
  readonly class = CertsCell

  static command = 129

  constructor(
    readonly circuit: undefined,
    readonly certs: Certs
  ) { }

  pack() {
    return this.cell().pack()
  }

  async getIdHash() {
    if (!this.certs.id)
      throw new Error(`Undefined ID cert`)

    const key = this.certs.id.cert.publicKey.rawData
    const hash = await crypto.subtle.digest("SHA-1", key)

    return Buffer.from(hash)
  }

  async checkId() {
    if (!this.certs.id)
      throw new Error(`Undefined ID cert`)
    this.certs.id.check()

    const algo = this.certs.id.cert.publicKey.algorithm as any

    if (!("modulusLength" in algo))
      throw new Error(`Undefined modulus length for ID cert`)
    if (algo.modulusLength !== 1024)
      throw new Error(`Invalid modulus length for ID cert`)

    const { publicKey, signatureAlgorithm } = this.certs.id.cert
    const key = await crypto.subtle.importKey("spki", publicKey.rawData, signatureAlgorithm, true, ["verify"]);
    const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, this.certs.id.cert.signature, (this.certs.id.cert as any).tbs)
    if (!verified) throw new Error(`Invalid signature for ID cert`)
  }

  async checkIdToTls() {
    if (!this.certs.id)
      throw new Error(`Undefined ID cert`)
    if (!this.certs.id_to_tls)
      throw new Error(`Undefined ID_TO_TLS cert`)
    this.certs.id_to_tls.check()

    const { publicKey, signatureAlgorithm } = this.certs.id.cert
    const key = await crypto.subtle.importKey("spki", publicKey.rawData, signatureAlgorithm, true, ["verify"]);
    const verified = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, this.certs.id_to_tls.cert.signature, (this.certs.id_to_tls.cert as any).tbs)
    if (!verified) throw new Error(`Invalid signature for ID_TO_TLS cert`)

    console.warn("Could not verify ID_TO_TLS cert key")
  }

  async checkIdToEid() {
    if (!this.certs.id)
      throw new Error(`Undefined ID cert`)
    if (!this.certs.id_to_eid)
      throw new Error(`Undefined ID_TO_EID cert`)
    this.certs.id_to_eid.check()

    const key = Buffer.from(this.certs.id.cert.publicKey.rawData)
    const identity = RsaPublicKey.from_public_key_der(key)

    const prefix = Buffer.from("Tor TLS RSA/Ed25519 cross-certificate")
    const prefixed = Buffer.concat([prefix, this.certs.id_to_eid.payload])
    const hashed = Buffer.from(await crypto.subtle.digest("SHA-256", prefixed))

    const verified = identity.verify(PaddingScheme.new_pkcs1v15_sign_raw(), hashed, this.certs.id_to_eid.signature)
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

  cell(): NewCell {
    throw new Error(`Unimplemented`)
  }

  static uncell(cell: NewCell) {
    if (cell.command !== this.command)
      throw new Error(`Invalid CERTS cell command ${cell.command}`)
    if (cell.circuit)
      throw new Error(`Can't uncell CERTS cell on circuit > 0`)

    const binary = new Binary(cell.payload)

    const ncerts = binary.readUint8()
    const certs: Certs = {}

    for (let i = 0; i < ncerts; i++) {
      const type = binary.readUint8()
      const length = binary.readUint16()

      if (type === RSA.Cert.types.ID) {
        if (certs.id) throw new Duplicated(type)
        certs.id = RSA.Cert.read(binary, type, length)
        continue
      }

      if (type === RSA.Cert.types.ID_TO_AUTH) {
        if (certs.id_to_auth) throw new Duplicated(type)
        certs.id_to_auth = RSA.Cert.read(binary, type, length)
        continue
      }

      if (type === RSA.Cert.types.ID_TO_TLS) {
        if (certs.id_to_tls) throw new Duplicated(type)
        certs.id_to_tls = RSA.Cert.read(binary, type, length)
        continue
      }

      if (type === Cross.Cert.types.ID_TO_EID) {
        if (certs.id_to_eid) throw new Duplicated(type)
        certs.id_to_eid = Cross.Cert.read(binary, type, length)
        continue
      }

      if (type === Ed25519.Cert.types.EID_TO_SIGNING) {
        if (certs.eid_to_signing) throw new Duplicated(type)
        certs.eid_to_signing = Ed25519.Cert.read(binary, type, length)
        continue
      }

      if (type === Ed25519.Cert.types.SIGNING_TO_TLS) {
        if (certs.signing_to_tls) throw new Duplicated(type)
        certs.signing_to_tls = Ed25519.Cert.read(binary, type, length)
        continue
      }

      if (type === Ed25519.Cert.types.SIGNING_TO_AUTH) {
        if (certs.signing_to_auth) throw new Duplicated(type)
        certs.signing_to_auth = Ed25519.Cert.read(binary, type, length)
        continue
      }

      throw new Error(`Unknown CERTS cell cert type ${type}`)
    }

    return new this(cell.circuit, certs)
  }

}