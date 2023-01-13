import { Binary } from "@hazae41/binary";
import { NewCell } from "mods/tor/binary/cells/cell.js";
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js";
import { Circuit } from "mods/tor/circuit.js";
import { PAYLOAD_LEN } from "mods/tor/constants.js";

export class CreatedFastCell {
  readonly #class = CreatedFastCell

  static command = 6

  constructor(
    readonly circuit: Circuit,
    readonly material: Uint8Array,
    readonly derivative: Uint8Array
  ) { }

  pack() {
    return this.cell().pack()
  }

  cell() {
    const binary = Binary.allocUnsafe(PAYLOAD_LEN)

    binary.write(this.material)
    binary.write(this.derivative)
    binary.fill()

    return new NewCell(this.circuit, this.#class.command, binary.buffer)
  }

  static uncell(cell: NewCell) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (!cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    const binary = new Binary(cell.payload)

    const material = binary.read(20)
    const derivative = binary.read(20)

    return new this(cell.circuit, material, derivative)
  }
}