import { BinaryReadError, BinaryWriteError } from "@hazae41/binary"
import { Cursor } from "@hazae41/cursor"
import { Ok, Result } from "@hazae41/result"

export class TypedAddress {

  static readonly types = {
    IPv4: 4,
    IPv6: 6
  } as const

  constructor(
    readonly type: number,
    readonly value: Uint8Array
  ) { }

  trySize(): Result<number, never> {
    return new Ok(1 + 1 + this.value.length)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return Result.unthrowSync(t => {
      cursor.tryWriteUint8(this.type).throw(t)
      cursor.tryWriteUint8(this.value.length).throw(t)
      cursor.tryWrite(this.value).throw(t)

      return Ok.void()
    })
  }

  static tryRead(cursor: Cursor): Result<TypedAddress, BinaryReadError> {
    return Result.unthrowSync(t => {
      const type = cursor.tryReadUint8().throw(t)
      const length = cursor.tryReadUint8().throw(t)
      const value = cursor.tryRead(length).throw(t)

      return new Ok(new TypedAddress(type, value))
    })
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

  trySize(): Result<number, never> {
    return new Ok(1 * 4)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return Result.unthrowSync(t => {
      const parts = this.address.split(".")

      for (let i = 0; i < 4; i++)
        cursor.tryWriteUint8(Number(parts[i])).throw(t)

      return Ok.void()
    })
  }

  static tryRead(cursor: Cursor): Result<Address4, BinaryReadError> {
    return Result.unthrowSync(t => {
      const parts = new Array<string>(4)

      for (let i = 0; i < 4; i++)
        parts[i] = String(cursor.tryReadUint8().throw(t))

      return new Ok(new Address4(parts.join(".")))
    })
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

  trySize(): Result<number, never> {
    return new Ok(2 * 8)
  }

  tryWrite(cursor: Cursor): Result<void, BinaryWriteError> {
    return Result.unthrowSync(t => {
      const parts = this.address.slice(1, -1).split(":")

      for (let i = 0; i < 8; i++)
        cursor.tryWriteUint16(Number(parts[i])).throw(t)

      return Ok.void()
    })
  }

  static tryRead(cursor: Cursor): Result<Address6, BinaryReadError> {
    return Result.unthrowSync(t => {
      const parts = new Array<string>(8)

      for (let i = 0; i < 8; i++)
        parts[i] = String(cursor.tryReadUint16().throw(t))

      return new Ok(new Address6(`[${parts.join(":")}]`))
    })
  }

}