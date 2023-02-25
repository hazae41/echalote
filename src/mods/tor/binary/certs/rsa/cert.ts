import { Cursor } from "@hazae41/binary";
import { Certificate } from "@hazae41/x509";
import { Cert as ICert } from "mods/tor/binary/certs/cert.js";

export class Cert implements ICert {
  readonly #class = Cert

  static types = {
    ID: 2,
    ID_TO_TLS: 1,
    ID_TO_AUTH: 3
  }

  constructor(
    readonly type: number,
    readonly data: Uint8Array,
    readonly x509: Certificate
  ) { }

  check() {
    const now = new Date()

    if (now > this.x509.tbsCertificate.validity.notAfter.value)
      throw new Error(`Late certificate`)
    if (now < this.x509.tbsCertificate.validity.notBefore.value)
      throw new Error(`Early certificate`)
  }

  write(cursor: Cursor) {
    cursor.writeUint8(this.type)
    cursor.writeUint16(this.data.length)
    cursor.write(this.data)
  }

  static read(cursor: Cursor, type: number, length: number) {
    const start = cursor.offset

    const data = cursor.read(length)
    const x509 = Certificate.fromBytes(data)

    if (cursor.offset - start !== length)
      throw new Error(`Invalid RSA cert length ${length}`)
    return new this(type, data, x509)
  }

}