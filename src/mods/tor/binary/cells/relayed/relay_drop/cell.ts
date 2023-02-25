import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { InvalidRelayCommand } from "mods/tor/binary/cells/errors.js";
import { Circuit } from "mods/tor/circuit.js";
import { TcpStream } from "mods/tor/streams/tcp.js";

export class RelayDropCell {
  readonly #class = RelayDropCell

  static rcommand = 10

  constructor(
    readonly circuit: Circuit,
    readonly stream: TcpStream | undefined,
    readonly data: Uint8Array
  ) { }

  cell() {
    return new RelayCell(this.circuit, this.stream, this.#class.rcommand, this.data)
  }

  static uncell(cell: RelayCell) {
    if (cell.rcommand !== this.rcommand)
      throw new InvalidRelayCommand(this.name, cell.rcommand)

    return new this(cell.circuit, cell.stream, cell.data)
  }
}