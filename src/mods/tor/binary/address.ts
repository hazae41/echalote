import { Cursor } from "@hazae41/cursor"

export class TypedAddress {

  static readonly types = {
    IPv4: 4,
    IPv6: 6
  } as const

  constructor(
    readonly type: number,
    readonly value: Uint8Array
  ) { }

  sizeOrThrow() {
    return 1 + 1 + this.value.length
  }

  writeOrThrow(cursor: Cursor) {
    cursor.tryWriteUint8(this.type)
    cursor.tryWriteUint8(this.value.length)
    cursor.tryWrite(this.value)
  }

  static readOrThrow(cursor: Cursor) {
    const type = cursor.readUint8OrThrow()
    const length = cursor.readUint8OrThrow()
    const value = cursor.readAndCopyOrThrow(length)

    return new TypedAddress(type, value)
  }

}

export class Address4 {

  /**
   * IPv4 address
   * @param address xxx.xxx.xxx.xxx
   */
  constructor(
    readonly address: string
  ) { }

  sizeOrThrow() {
    return 4
  }

  writeOrThrow(cursor: Cursor) {
    const parts = this.address.split(".")

    for (let i = 0; i < 4; i++)
      cursor.writeUint8OrThrow(Number(parts[i]))

    return
  }

  static readOrThrow(cursor: Cursor) {
    const parts = new Array<string>(4)

    for (let i = 0; i < 4; i++)
      parts[i] = String(cursor.readUint8OrThrow())

    return new Address4(parts.join("."))
  }

}

export class Address6 {

  /**
   * IPv6 address
   * @param address [xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx:xxxx]
   */
  constructor(
    readonly address: `[${string}]`
  ) { }

  sizeOrThrow() {
    return 16
  }

  writeOrThrow(cursor: Cursor) {
    const parts = this.address.slice(1, -1).split(":")

    for (let i = 0; i < 8; i++)
      cursor.writeUint16OrThrow(Number(parts[i]))

    return
  }

  static readOrThrow(cursor: Cursor) {
    const parts = new Array<string>(8)

    for (let i = 0; i < 8; i++)
      parts[i] = String(cursor.readUint16OrThrow())

    return new Address6(`[${parts.join(":")}]`)
  }

}