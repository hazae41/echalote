import { X509Certificate } from "@peculiar/x509";
import { Binary } from "libs/binary.js";
import { Cert as ICert } from "mods/tor/binary/certs/cert.js";

export class Cert implements ICert {
  readonly class = Cert

  static types = {
    ID: 2,
    ID_TO_TLS: 1,
    ID_TO_AUTH: 3
  }

  constructor(
    readonly type: number,
    readonly data: Buffer,
    readonly cert: X509Certificate
  ) { }

  write(binary: Binary) {
    binary.writeUint8(this.type)
    binary.writeUint16(this.data.length)
    binary.write(this.data)
  }

  check() {
    const now = new Date()

    if (now > this.cert.notAfter)
      throw new Error(`Late certificate`)
    if (now < this.cert.notBefore)
      throw new Error(`Early certificate`)
  }

  static read(binary: Binary, type: number, length: number) {
    const start = binary.offset

    const data = binary.read(length)
    const cert = new X509Certificate(data)

    if (binary.offset - start !== length)
      throw new Error(`Invalid RSA cert length ${length}`)
    return new this(type, data, cert)
  }

}