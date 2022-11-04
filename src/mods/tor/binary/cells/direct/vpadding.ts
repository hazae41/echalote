import { NewCell } from "mods/tor/binary/cells/cell.js"
import { Circuit } from "mods/tor/circuit.js"
import { PAYLOAD_LEN } from "mods/tor/constants.js"

export class VariablePaddingCell {
  readonly class = VariablePaddingCell

  static command = 128

  constructor(
    readonly circuit: Circuit | undefined,
    readonly data = Buffer.alloc(PAYLOAD_LEN)
  ) { }

  pack() {
    return this.cell().pack()
  }

  cell() {
    return new NewCell(this.circuit, this.class.command, this.data)
  }

  static uncell(cell: NewCell) {
    if (cell.command !== this.command)
      throw new Error(`Invalid VPADDING cell command ${cell.command}`)

    return new this(cell.circuit, cell.payload)
  }
}