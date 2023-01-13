import { Binary } from "@hazae41/binary";

export class TypedAddress {
  readonly #class = TypedAddress

  static IPv4 = 4
  static IPv6 = 6

  constructor(
    readonly type: number,
    readonly value: Uint8Array
  ) { }

  write(binary: Binary) {
    binary.writeUint8(this.type)
    binary.writeUint8(this.value.length)
    binary.write(this.value)
  }

  static read(binary: Binary) {
    const type = binary.readUint8()
    const length = binary.readUint8()
    const value = binary.read(length)

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

  write(binary: Binary) {
    const parts = this.address.split(".")

    for (let i = 0; i < 4; i++)
      binary.writeUint8(Number(parts[i]))
  }

  static read(binary: Binary) {
    const parts = new Array<string>(4)

    for (let i = 0; i < 4; i++)
      parts[i] = String(binary.readUint8())

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

  write(binary: Binary) {
    const parts = this.address.slice(1, -1).split(":")

    for (let i = 0; i < 8; i++)
      binary.writeUint16(Number(parts[i]))
  }

  static read(binary: Binary) {
    const parts = new Array<string>(8)

    for (let i = 0; i < 8; i++)
      parts[i] = String(binary.readUint16())

    return new this(`[${parts.join(":")}]`)
  }
}