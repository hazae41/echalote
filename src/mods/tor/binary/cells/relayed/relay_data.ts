import { RelayCell } from "mods/tor/binary/cells/direct/relay.js";
import { Circuit } from "mods/tor/circuit.js";
import { TcpStream } from "mods/tor/streams/tcp.js";

export class RelayDataCell {
  readonly class = RelayDataCell

  static rcommand = 2

  constructor(
    readonly circuit: Circuit,
    readonly stream: TcpStream,
    readonly data: Buffer
  ) { }

  async pack() {
    return await this.cell().pack()
  }

  cell() {
    return new RelayCell(this.circuit, this.stream, this.class.rcommand, this.data)
  }

  static uncell(cell: RelayCell) {
    if (cell.rcommand !== this.rcommand)
      throw new Error(`Invalid RELAY_DATA relay cell relay command`)
    if (!cell.stream)
      throw new Error(`Can't uncell RELAY_DATA relay cell on stream 0`)

    return new this(cell.circuit, cell.stream, cell.data)
  }
}