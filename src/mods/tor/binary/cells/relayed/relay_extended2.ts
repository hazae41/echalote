import { Binary } from "libs/binary.js";
import { RelayCell } from "mods/tor/binary/cells/direct/relay.js";
import { Circuit } from "mods/tor/circuit.js";

export class RelayExtended2Cell {
  readonly class = RelayExtended2Cell

  static rcommand = 15

  constructor(
    readonly circuit: Circuit,
    readonly stream: undefined,
    readonly data: Buffer
  ) { }

  async pack() {
    return await this.cell().pack()
  }

  cell(): RelayCell {
    throw new Error(`Unimplemented`)
  }

  static uncell(cell: RelayCell) {
    if (cell.rcommand !== this.rcommand)
      throw new Error(`Invalid RELAY_EXTENDED2 relay cell relay command`)
    if (cell.stream)
      throw new Error(`Can't uncell RELAY_EXTENDED2 relay cell on stream > 0`)

    const binary = new Binary(cell.data)

    const length = binary.readUint16()
    const data = binary.read(length)

    return new this(cell.circuit, cell.stream, data)
  }
}