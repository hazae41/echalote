import { Cursor, Opaque } from "@hazae41/binary";
import { Cell } from "mods/tor/binary/cells/cell.js";
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js";
import { Circuit } from "mods/tor/circuit.js";

export class Create2Cell {
  readonly #class = Create2Cell

  static command = 10

  static types = {
    /**
     * The old, slow, and insecure handshake
     * @deprecated
     */
    TAP: 0,
    /**
     * The new, quick, and secure handshake
     */
    NTOR: 2
  }

  constructor(
    readonly circuit: Circuit,
    readonly type: number,
    readonly data: Uint8Array
  ) { }

  get command() {
    return this.#class.command
  }

  size() {
    return 2 + 2 + this.data.length
  }

  write(cursor: Cursor) {
    cursor.writeUint16(this.type)
    cursor.writeUint16(this.data.length)
    cursor.write(this.data)
  }

  static read(cursor: Cursor) {
    const type = cursor.readUint16()
    const length = cursor.readUint16()
    const data = cursor.read(length)

    cursor.offset += cursor.remaining

    return { type, data }
  }

  static uncell(cell: Cell<Opaque>) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (!cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    const { type, data } = cell.payload.into(this)
    return new this(cell.circuit, type, data)
  }
}