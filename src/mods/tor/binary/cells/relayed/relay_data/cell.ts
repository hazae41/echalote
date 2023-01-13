import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { InvalidRelayCommand, InvalidStream } from "mods/tor/binary/cells/errors.js";
import { Circuit } from "mods/tor/circuit.js";
import { TcpStream } from "mods/tor/streams/tcp.js";

export class RelayDataCell {
  readonly #class = RelayDataCell

  static rcommand = 2

  constructor(
    readonly circuit: Circuit,
    readonly stream: TcpStream,
    readonly data: Uint8Array
  ) { }

  async pack() {
    return await this.cell().pack()
  }

  cell() {
    return new RelayCell(this.circuit, this.stream, this.#class.rcommand, this.data)
  }

  static uncell(cell: RelayCell) {
    if (cell.rcommand !== this.rcommand)
      throw new InvalidRelayCommand(this.name, cell.rcommand)
    if (!cell.stream)
      throw new InvalidStream(this.name, cell.stream)

    return new this(cell.circuit, cell.stream, cell.data)
  }
}