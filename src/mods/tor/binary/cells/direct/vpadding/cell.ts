import { Cursor, Opaque } from "@hazae41/binary"
import { Cell } from "mods/tor/binary/cells/cell.js"
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js"

export class VariablePaddingCell {
  readonly #class = VariablePaddingCell

  static command = 128

  constructor(
    readonly circuit: undefined,
    readonly data: Uint8Array
  ) { }

  get command() {
    return this.#class.command
  }

  size() {
    return this.data.length
  }

  write(cursor: Cursor) {
    cursor.write(this.data)
  }

  static read(cursor: Cursor) {
    const data = cursor.read(cursor.remaining)

    return { data }
  }

  static uncell(cell: Cell<Opaque>) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    const { data } = cell.payload.into(this)
    return new this(cell.circuit, data)
  }
}