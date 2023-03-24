import { Cursor, Opaque } from "@hazae41/binary"
import { Cell } from "mods/tor/binary/cells/cell.js"
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js"
import { Duplicated } from "mods/tor/binary/certs/errors.js"
import { CrossCert, Ed25519Cert, RsaCert } from "mods/tor/binary/certs/index.js"

export interface CertsObject {
  rsa_self?: RsaCert,
  rsa_to_tls?: RsaCert,
  rsa_to_auth?: RsaCert,
  rsa_to_ed?: CrossCert,
  ed_to_sign?: Ed25519Cert,
  sign_to_tls?: Ed25519Cert,
  sign_to_auth?: Ed25519Cert,
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

  static read(cursor: Cursor) {
    const ncerts = cursor.readUint8()
    const certs: CertsObject = {}

    for (let i = 0; i < ncerts; i++) {
      const type = cursor.readUint8()
      const length = cursor.readUint16()

      if (type === RsaCert.types.RSA_SELF) {
        if (certs.rsa_self) throw new Duplicated(type)
        certs.rsa_self = RsaCert.read(cursor, type, length)
        continue
      }

      if (type === RsaCert.types.RSA_TO_AUTH) {
        if (certs.rsa_to_auth) throw new Duplicated(type)
        certs.rsa_to_auth = RsaCert.read(cursor, type, length)
        continue
      }

      if (type === RsaCert.types.RSA_TO_TLS) {
        if (certs.rsa_to_tls) throw new Duplicated(type)
        certs.rsa_to_tls = RsaCert.read(cursor, type, length)
        continue
      }

      if (type === CrossCert.types.RSA_TO_ED) {
        if (certs.rsa_to_ed) throw new Duplicated(type)
        certs.rsa_to_ed = CrossCert.read(cursor, type, length)
        continue
      }

      if (type === Ed25519Cert.types.ED_TO_SIGN) {
        if (certs.ed_to_sign) throw new Duplicated(type)
        certs.ed_to_sign = Ed25519Cert.read(cursor, type, length)
        continue
      }

      if (type === Ed25519Cert.types.SIGN_TO_TLS) {
        if (certs.sign_to_tls) throw new Duplicated(type)
        certs.sign_to_tls = Ed25519Cert.read(cursor, type, length)
        continue
      }

      if (type === Ed25519Cert.types.SIGN_TO_AUTH) {
        if (certs.sign_to_auth) throw new Duplicated(type)
        certs.sign_to_auth = Ed25519Cert.read(cursor, type, length)
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