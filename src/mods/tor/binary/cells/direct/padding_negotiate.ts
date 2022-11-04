import { Binary } from "libs/binary.js"
import { NewCell } from "mods/tor/binary/cells/cell.js"
import { Circuit } from "mods/tor/circuit.js"
import { PAYLOAD_LEN } from "mods/tor/constants.js"

export class PaddingNegociateCell {
  readonly class = PaddingNegociateCell

  static command = 12

  static versions = {
    ZERO: 0
  }

  static commands = {
    STOP: 1,
    START: 2
  }

  constructor(
    readonly circuit: Circuit | undefined,
    readonly version: number,
    readonly pcommand: number,
    readonly ito_low_ms: number,
    readonly ito_high_ms: number
  ) { }

  pack() {
    return this.cell().pack()
  }

  cell() {
    const binary = Binary.allocUnsafe(PAYLOAD_LEN)

    binary.writeUint8(this.version)
    binary.writeUint8(this.pcommand)
    binary.writeUint16(this.ito_low_ms)
    binary.writeUint16(this.ito_high_ms)
    binary.fill()

    return new NewCell(this.circuit, this.class.command, binary.buffer)
  }

  static uncell(cell: NewCell) {
    const binary = new Binary(cell.payload)

    const version = binary.readUint8()
    const pcommand = binary.readUint8()
    const ito_low_ms = binary.readUint16()
    const ito_high_ms = binary.readUint16()

    return new this(cell.circuit, version, pcommand, ito_low_ms, ito_high_ms)
  }
}