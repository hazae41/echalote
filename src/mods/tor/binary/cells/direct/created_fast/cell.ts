import { Cursor, Opaque } from "@hazae41/binary";
import { Cell } from "mods/tor/binary/cells/cell.js";
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js";
import { SecretCircuit } from "mods/tor/circuit.js";

export class CreatedFastCell {
  readonly #class = CreatedFastCell

  static command = 6

  constructor(
    readonly circuit: SecretCircuit,
    readonly material: Uint8Array,
    readonly derivative: Uint8Array
  ) { }

  get command() {
    return this.#class.command
  }

  size() {
    return this.material.length + this.derivative.length
  }

  write(cursor: Cursor) {
    cursor.write(this.material)
    cursor.write(this.derivative)
  }

  static read(cursor: Cursor) {
    const material = new Uint8Array(cursor.read(20))
    const derivative = new Uint8Array(cursor.read(20))

    cursor.offset += cursor.remaining

    return { material, derivative }
  }

  static uncell(cell: Cell<Opaque>) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (!cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    const { material, derivative } = cell.payload.into(this)
    return new this(cell.circuit, material, derivative)
  }
}