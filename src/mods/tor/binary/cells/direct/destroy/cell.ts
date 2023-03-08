import { Cursor, Opaque } from "@hazae41/binary"
import { Cell } from "mods/tor/binary/cells/cell.js"
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js"
import { SecretCircuit } from "mods/tor/circuit.js"

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
    readonly circuit: SecretCircuit,
    readonly reason: number
  ) { }

  get command() {
    return this.#class.command
  }

  size() {
    return 1
  }

  write(cursor: Cursor) {
    cursor.writeUint8(this.reason)
  }

  static read(cursor: Cursor) {
    const code = cursor.readUint8()

    cursor.offset += cursor.remaining

    return { code }
  }

  static uncell(cell: Cell<Opaque>) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (!cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    const { code } = cell.payload.into(this)
    return new this(cell.circuit, code)
  }
}