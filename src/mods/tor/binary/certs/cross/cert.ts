import { Binary } from "@hazae41/binary";
import { Cert as ICert } from "mods/tor/binary/certs/cert.js";

export class Cert implements ICert {
  readonly #class = Cert

  static types = {
    ID_TO_EID: 7
  }

  constructor(
    readonly type: number,
    readonly key: Buffer,
    readonly expiration: Date,
    readonly payload: Buffer,
    readonly signature: Buffer
  ) { }

  write(binary: Binary) {
    throw new Error(`Unimplemented`)
  }

  check() {
    const now = new Date()

    if (now > this.expiration)
      throw new Error(`Late certificate`)
  }

  static read(binary: Binary, type: number, length: number) {
    const start = binary.offset

    const key = binary.read(32)

    const expDateHours = binary.readUint32()
    const expiration = new Date(expDateHours * 60 * 60 * 1000)

    const payload = binary.reread(start)

    const sigLength = binary.readUint8()
    const signature = binary.read(sigLength)

    if (binary.offset - start !== length)
      throw new Error(`Invalid Cross cert length ${length}`)
    return new this(type, key, expiration, payload, signature)
  }
}