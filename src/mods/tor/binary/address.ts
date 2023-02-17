import { Cursor } from "@hazae41/binary";

export class TypedAddress {
  readonly #class = TypedAddress

  static IPv4 = 4
  static IPv6 = 6

  constructor(
    readonly type: number,
    readonly value: Uint8Array
  ) { }

  write(cursor: Cursor) {
    cursor.writeUint8(this.type)
    cursor.writeUint8(this.value.length)
    cursor.write(this.value)
  }

  static read(cursor: Cursor) {
    const type = cursor.readUint8()
    const length = cursor.readUint8()
    const value = cursor.read(length)

    return new this(type, value)
  }
}

export class Address4 {
  readonly #class = Address4

  /**
   * IPv4 address
   * @param address xxx.xxx.xxx.xxx
   */
  constructor(
    readonly address: string
  ) { }

  write(cursor: Cursor) {
    const parts = this.address.split(".")

    for (let i = 0; i < 4; i++)
      cursor.writeUint8(Number(parts[i]))
  }

  static read(cursor: Cursor) {
    const parts = new Array<string>(4)

    for (let i = 0; i < 4; i++)
      parts[i] = String(cursor.readUint8())

    return new this(parts.join("."))
  }
}

export class Address6 {
  readonly #class = Address6

  /**
   * IPv6 address
   * @param address [xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx]
   */
  constructor(
    readonly address: string
  ) { }

  write(cursor: Cursor) {
    const parts = this.address.slice(1, -1).split(":")

    for (let i = 0; i < 8; i++)
      cursor.writeUint16(Number(parts[i]))
  }

  static read(cursor: Cursor) {
    const parts = new Array<string>(8)

    for (let i = 0; i < 8; i++)
      parts[i] = String(cursor.readUint16())

    return new this(`[${parts.join(":")}]`)
  }
}