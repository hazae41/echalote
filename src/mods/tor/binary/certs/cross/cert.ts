import { Cursor } from "@hazae41/binary";
import { Cert as ICert } from "mods/tor/binary/certs/cert.js";

export class Cert implements ICert {
  readonly #class = Cert

  static types = {
    ID_TO_EID: 7
  }

  constructor(
    readonly type: number,
    readonly key: Uint8Array,
    readonly expiration: Date,
    readonly payload: Uint8Array,
    readonly signature: Uint8Array
  ) { }

  check() {
    const now = new Date()

    if (now > this.expiration)
      throw new Error(`Late certificate`)
  }

  write(cursor: Cursor) {
    throw new Error(`Unimplemented`)
  }

  static read(cursor: Cursor, type: number, length: number) {
    const start = cursor.offset

    const key = cursor.read(32)

    const expDateHours = cursor.readUint32()
    const expiration = new Date(expDateHours * 60 * 60 * 1000)

    const content = cursor.offset - start
    cursor.offset = start
    const payload = cursor.read(content)

    const sigLength = cursor.readUint8()
    const signature = cursor.read(sigLength)

    if (cursor.offset - start !== length)
      throw new Error(`Invalid Cross cert length ${length}`)
    return new this(type, key, expiration, payload, signature)
  }
}