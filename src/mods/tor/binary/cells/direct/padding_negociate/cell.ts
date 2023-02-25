import { Cursor, Opaque } from "@hazae41/binary"
import { Cell } from "mods/tor/binary/cells/cell.js"
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js"

export class PaddingNegociateCell {
  readonly #class = PaddingNegociateCell

  static command = 12

  static versions = {
    ZERO: 0
  }

  static commands = {
    STOP: 1,
    START: 2
  }

  constructor(
    readonly circuit: undefined,
    readonly version: number,
    readonly pcommand: number,
    readonly ito_low_ms: number,
    readonly ito_high_ms: number
  ) { }

  get command() {
    return this.#class.command
  }

  size() {
    return 1 + 1 + 2 + 2
  }

  write(cursor: Cursor) {
    cursor.writeUint8(this.version)
    cursor.writeUint8(this.pcommand)
    cursor.writeUint16(this.ito_low_ms)
    cursor.writeUint16(this.ito_high_ms)
  }

  static uncell(cell: Cell<Opaque>) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    const cursor = new Cursor(cell.payload.bytes)

    const version = cursor.readUint8()
    const pcommand = cursor.readUint8()
    const ito_low_ms = cursor.readUint16()
    const ito_high_ms = cursor.readUint16()

    return new this(cell.circuit, version, pcommand, ito_low_ms, ito_high_ms)
  }
}