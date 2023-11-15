import { Cursor } from "@hazae41/cursor"

export class PaddingNegociateCell {
  readonly #class = PaddingNegociateCell

  static readonly old = false
  static readonly circuit = false
  static readonly command = 12

  static readonly versions = {
    ZERO: 0
  } as const

  static readonly commands = {
    STOP: 1,
    START: 2
  } as const

  constructor(
    readonly version: number,
    readonly pcommand: number,
    readonly ito_low_ms: number,
    readonly ito_high_ms: number
  ) { }

  get old(): false {
    return this.#class.old
  }

  get circuit(): false {
    return this.#class.circuit
  }

  get command() {
    return this.#class.command
  }

  sizeOrThrow() {
    return 1 + 1 + 2 + 2
  }

  writeOrThrow(cursor: Cursor) {
    cursor.writeUint8OrThrow(this.version)
    cursor.writeUint8OrThrow(this.pcommand)
    cursor.writeUint16OrThrow(this.ito_low_ms)
    cursor.writeUint16OrThrow(this.ito_high_ms)
  }

  static readOrThrow(cursor: Cursor) {
    const version = cursor.readUint8OrThrow()
    const pcommand = cursor.readUint8OrThrow()
    const ito_low_ms = cursor.readUint16OrThrow()
    const ito_high_ms = cursor.readUint16OrThrow()

    cursor.offset += cursor.remaining

    return new PaddingNegociateCell(version, pcommand, ito_low_ms, ito_high_ms)
  }

}