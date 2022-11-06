import { Binary } from "libs/binary.js";
import { NewCell } from "mods/tor/binary/cells/cell.js";
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js";
import { Circuit } from "mods/tor/circuit.js";
import { PAYLOAD_LEN } from "mods/tor/constants.js";

export class CreateFastCell {
  readonly class = CreateFastCell

  static command = 5

  /**
   * The CREATE_FAST cell
   * @param material Key material (X) [20]
   */
  constructor(
    readonly circuit: Circuit,
    readonly material: Buffer
  ) { }

  pack() {
    return this.cell().pack()
  }

  cell() {
    const binary = Binary.allocUnsafe(PAYLOAD_LEN)

    if (this.material.length !== 20)
      throw new Error(`Invalid ${this.class.name} material length`)
    binary.write(this.material)
    binary.fill()

    return new NewCell(this.circuit, this.class.command, binary.buffer)
  }

  static uncell(cell: NewCell) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (!cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    const binary = new Binary(cell.payload)

    const material = binary.read(20)

    return new this(cell.circuit, material)
  }
}