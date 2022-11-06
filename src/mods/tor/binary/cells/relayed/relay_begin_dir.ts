import { Binary } from "libs/binary.js";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { InvalidRelayCommand, InvalidStream } from "mods/tor/binary/cells/errors.js";
import { Circuit } from "mods/tor/circuit.js";
import { PAYLOAD_LEN } from "mods/tor/constants.js";
import { TcpStream } from "mods/tor/streams/tcp.js";

export class RelayBeginDirCell {
  readonly class = RelayBeginDirCell

  static rcommand = 13

  constructor(
    readonly circuit: Circuit,
    readonly stream: TcpStream
  ) { }

  async pack() {
    return await this.cell().pack()
  }

  cell() {
    const binary = Binary.allocUnsafe(PAYLOAD_LEN)

    binary.fill()

    return new RelayCell(this.circuit, this.stream, this.class.rcommand, binary.sliced)
  }

  static uncell(cell: RelayCell) {
    if (cell.rcommand !== this.rcommand)
      throw new InvalidRelayCommand(this.name, cell.rcommand)
    if (!cell.stream)
      throw new InvalidStream(this.name, cell.stream)

    if (cell.data.find(it => it !== 0))
      throw new Error(`Invalid ${this.name} data`)

    return new this(cell.circuit, cell.stream)
  }
}