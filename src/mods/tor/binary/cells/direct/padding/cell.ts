import { Bytes } from "@hazae41/bytes"
import { NewCell } from "mods/tor/binary/cells/cell.js"
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js"
import { PAYLOAD_LEN } from "mods/tor/constants.js"

export class PaddingCell {
  readonly #class = PaddingCell

  static command = 0

  constructor(
    readonly circuit: undefined,
    readonly data = Bytes.alloc(PAYLOAD_LEN)
  ) { }

  pack() {
    return this.cell().pack()
  }

  cell() {
    return new NewCell(this.circuit, this.#class.command, this.data)
  }

  static uncell(cell: NewCell) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    return new this(cell.circuit, cell.payload)
  }
}