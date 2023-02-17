import { Cursor } from "@hazae41/binary";
import { NewCell } from "mods/tor/binary/cells/cell.js";
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js";
import { Circuit } from "mods/tor/circuit.js";
import { PAYLOAD_LEN } from "mods/tor/constants.js";

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

  pack() {
    return this.cell().pack()
  }

  cell() {
    const cursor = Cursor.allocUnsafe(PAYLOAD_LEN)

    cursor.writeUint16(this.type)
    cursor.writeUint16(this.data.length)
    cursor.write(this.data)
    cursor.fill()

    return new NewCell(this.circuit, this.#class.command, cursor.buffer)
  }

  static uncell(cell: NewCell) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (!cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    const cursor = new Cursor(cell.payload)

    const type = cursor.readUint16()
    const length = cursor.readUint16()
    const data = cursor.read(length)

    return new this(cell.circuit, type, data)
  }
}