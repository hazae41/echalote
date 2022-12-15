import { Certificate } from "@hazae41/x509";
import { Binary } from "libs/binary.js";
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
    readonly data: Buffer,
    readonly x509: Certificate
  ) { }

  write(binary: Binary) {
    binary.writeUint8(this.type)
    binary.writeUint16(this.data.length)
    binary.write(this.data)
  }

  check() {
    const now = new Date()

    if (now > this.x509.tbsCertificate.validity.notAfter.value)
      throw new Error(`Late certificate`)
    if (now < this.x509.tbsCertificate.validity.notBefore.value)
      throw new Error(`Early certificate`)
  }

  static read(binary: Binary, type: number, length: number) {
    const start = binary.offset

    const data = binary.read(length)
    const x509 = Certificate.fromBuffer(data)

    if (binary.offset - start !== length)
      throw new Error(`Invalid RSA cert length ${length}`)
    return new this(type, data, x509)
  }

}