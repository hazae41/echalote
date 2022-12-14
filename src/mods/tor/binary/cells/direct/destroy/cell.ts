import { Binary } from "@hazae41/binary"
import { NewCell } from "mods/tor/binary/cells/cell.js"
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js"
import { Circuit } from "mods/tor/circuit.js"
import { PAYLOAD_LEN } from "mods/tor/constants.js"

export class DestroyCell {
  readonly #class = DestroyCell

  static command = 4

  static reasons = {
    NONE: 0,
    PROTOCOL: 1,
    INTERNAL: 2,
    REQUESTED: 3,
    HIBERNATING: 4,
    RESOURCELIMIT: 5,
    CONNECTFAILED: 6,
    OR_IDENTITY: 7,
    CHANNEL_CLOSED: 8,
    FINISHED: 9,
    TIMEOUT: 10,
    DESTROYED: 11,
    NOSUCHSERVICE: 12
  }

  constructor(
    readonly circuit: Circuit,
    readonly reason: number
  ) { }

  pack() {
    return this.cell().pack()
  }

  cell() {
    const binary = Binary.allocUnsafe(PAYLOAD_LEN)

    binary.writeUint8(this.reason)
    binary.fill()

    return new NewCell(this.circuit, this.#class.command, binary.buffer)
  }

  static uncell(cell: NewCell) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (!cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    const binary = new Binary(cell.payload)

    const code = binary.readUint8()

    return new this(cell.circuit, code)
  }
}