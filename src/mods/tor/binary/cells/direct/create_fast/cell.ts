import { Cursor } from "@hazae41/binary";
import { NewCell } from "mods/tor/binary/cells/cell.js";
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js";
import { Circuit } from "mods/tor/circuit.js";
import { PAYLOAD_LEN } from "mods/tor/constants.js";

export class CreateFastCell {
  readonly #class = CreateFastCell

  static command = 5

  /**
   * The CREATE_FAST cell
   * @param material Key material (X) [20]
   */
  constructor(
    readonly circuit: Circuit,
    readonly material: Uint8Array
  ) { }

  pack() {
    return this.cell().pack()
  }

  cell() {
    const cursor = Cursor.allocUnsafe(PAYLOAD_LEN)

    if (this.material.length !== 20)
      throw new Error(`Invalid ${this.#class.name} material length`)
    cursor.write(this.material)
    cursor.fill()

    return new NewCell(this.circuit, this.#class.command, cursor.bytes)
  }

  static uncell(cell: NewCell) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (!cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    const cursor = new Cursor(cell.payload)

    const material = cursor.read(20)

    return new this(cell.circuit, material)
  }
}