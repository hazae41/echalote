import { Binary } from "libs/binary.js";
import { DestroyCell } from "mods/tor/binary/cells/direct/destroy.js";
import { RelayCell } from "mods/tor/binary/cells/direct/relay.js";
import { InvalidRelayCommand, InvalidStream } from "mods/tor/binary/cells/errors.js";
import { Circuit } from "mods/tor/circuit.js";

export class RelayTruncateCell {
  readonly class = RelayTruncateCell

  static rcommand = 8

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
    const binary = Binary.allocUnsafe(1)

    binary.writeUint8(this.reason)

    return new RelayCell(this.circuit, this.stream, this.class.rcommand, binary.buffer)
  }

  static uncell(cell: RelayCell) {
    if (cell.rcommand !== this.rcommand)
      throw new InvalidRelayCommand(this.name, cell.rcommand)
    if (cell.stream)
      throw new InvalidStream(this.name, cell.stream)

    const binary = new Binary(cell.data)

    const reason = binary.readUint8()

    return new this(cell.circuit, cell.stream, reason)
  }
}