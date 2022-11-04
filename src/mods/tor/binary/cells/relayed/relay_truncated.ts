import { Binary } from "libs/binary.js";
import { DestroyCell } from "mods/tor/binary/cells/direct/destroy.js";
import { RelayCell } from "mods/tor/binary/cells/direct/relay.js";
import { Circuit } from "mods/tor/circuit.js";

export class RelayTruncatedCell {
  readonly class = RelayTruncatedCell

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
    const binary = Binary.allocUnsafe(1)

    binary.writeUint8(this.reason)

    return new RelayCell(this.circuit, this.stream, this.class.rcommand, binary.buffer)
  }

  static uncell(cell: RelayCell) {
    if (cell.rcommand !== this.rcommand)
      throw new Error(`Invalid RELAY_TRUNCATED relay cell relay command`)
    if (cell.stream)
      throw new Error(`Can't uncell RELAY_TRUNCATED relay cell on stream > 0`)

    const binary = new Binary(cell.data)

    const reason = binary.readUint8()

    return new this(cell.circuit, cell.stream, reason)
  }
}