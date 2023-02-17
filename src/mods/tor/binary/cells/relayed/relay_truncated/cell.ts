import { Cursor } from "@hazae41/binary";
import { DestroyCell } from "mods/tor/binary/cells/direct/destroy/cell.js";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { InvalidRelayCommand, InvalidStream } from "mods/tor/binary/cells/errors.js";
import { Circuit } from "mods/tor/circuit.js";

export class RelayTruncatedCell {
  readonly #class = RelayTruncatedCell

  static rcommand = 9

  static reasons = DestroyCell.reasons

  constructor(
    readonly circuit: Circuit,
    readonly stream: undefined,
    readonly reason: number
  ) { }

  async pack() {
    return await this.cell().pack()
  }

  cell() {
    const binary = Cursor.allocUnsafe(1)

    binary.writeUint8(this.reason)

    return new RelayCell(this.circuit, this.stream, this.#class.rcommand, binary.buffer)
  }

  static uncell(cell: RelayCell) {
    if (cell.rcommand !== this.rcommand)
      throw new InvalidRelayCommand(this.name, cell.rcommand)
    if (cell.stream)
      throw new InvalidStream(this.name, cell.stream)

    const binary = new Cursor(cell.data)

    const reason = binary.readUint8()

    return new this(cell.circuit, cell.stream, reason)
  }
}