import { Cursor } from "@hazae41/cursor";

export class Create2Cell {
  readonly #class = Create2Cell

  static readonly circuit = true
  static readonly command = 10

  static readonly types = {
    /**
     * The old, slow, and insecure handshake
     * @deprecated
     */
    TAP: 0,
    /**
     * The new, quick, and secure handshake
     */
    NTOR: 2
  } as const

  constructor(
    readonly type: number,
    readonly data: Uint8Array
  ) { }

  get command() {
    return this.#class.command
  }

  sizeOrThrow() {
    return 2 + 2 + this.data.length
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint16OrThrow(this.type)
    cursor.writeUint16OrThrow(this.data.length)
    cursor.writeOrThrow(this.data)
  }

  static readOrThrow(cursor: Cursor) {
    const type = cursor.readUint16OrThrow()
    const length = cursor.readUint16OrThrow()
    const data = cursor.readAndCopyOrThrow(length)

    cursor.offset += cursor.remaining

    return new Create2Cell(type, data)
  }

}