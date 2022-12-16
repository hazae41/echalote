import { Binary } from "@hazae41/binary";
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
    readonly data: Buffer
  ) { }

  pack() {
    return this.cell().pack()
  }

  cell() {
    const binary = Binary.allocUnsafe(PAYLOAD_LEN)

    binary.writeUint16(this.type)
    binary.writeUint16(this.data.length)
    binary.write(this.data)
    binary.fill()

    return new NewCell(this.circuit, this.#class.command, binary.buffer)
  }

  static uncell(cell: NewCell) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (!cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    const binary = new Binary(cell.payload)

    const type = binary.readUint16()
    const length = binary.readUint16()
    const data = binary.read(length)

    return new this(cell.circuit, type, data)
  }
}