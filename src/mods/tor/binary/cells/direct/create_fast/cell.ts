import { Cursor, Opaque } from "@hazae41/binary";
import { Cell } from "mods/tor/binary/cells/cell.js";
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js";
import { SecretCircuit } from "mods/tor/circuit.js";

export class CreateFastCell {
  readonly #class = CreateFastCell

  static command = 5

  /**
   * The CREATE_FAST cell
   * @param material Key material (X) [20]
   */
  constructor(
    readonly circuit: SecretCircuit,
    readonly material: Uint8Array
  ) { }

  get command() {
    return this.#class.command
  }

  size() {
    return this.material.length
  }

  write(cursor: Cursor) {
    cursor.write(this.material)
  }

  static read(cursor: Cursor) {
    const material = new Uint8Array(cursor.read(20))

    cursor.offset += cursor.remaining

    return { material }
  }

  static uncell(cell: Cell<Opaque>) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (!cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    const { material } = cell.payload.into(this)
    return new this(cell.circuit, material)
  }
}