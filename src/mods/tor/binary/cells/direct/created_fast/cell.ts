import { Cursor } from "@hazae41/binary";
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
    const cursor = Cursor.allocUnsafe(PAYLOAD_LEN)

    cursor.write(this.material)
    cursor.write(this.derivative)
    cursor.fill()

    return new NewCell(this.circuit, this.#class.command, cursor.bytes)
  }

  static uncell(cell: NewCell) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (!cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    const cursor = new Cursor(cell.payload)

    const material = new Uint8Array(cursor.read(20))
    const derivative = new Uint8Array(cursor.read(20))

    return new this(cell.circuit, material, derivative)
  }
}