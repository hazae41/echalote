import { Cursor } from "@hazae41/binary";
import { Bitmask } from "libs/bits.js";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/index.js";
import { InvalidRelayCommand, InvalidStream } from "mods/tor/binary/cells/errors.js";
import { Circuit } from "mods/tor/circuit.js";
import { PAYLOAD_LEN } from "mods/tor/constants.js";
import { TcpStream } from "mods/tor/streams/tcp.js";

export class RelayBeginCell {
  readonly #class = RelayBeginCell

  static rcommand = 1

  static flags = {
    IPV4_OK: 0,
    IPV6_NOT_OK: 1,
    IPV6_PREFER: 2
  }

  constructor(
    readonly circuit: Circuit,
    readonly stream: TcpStream,
    readonly address: string,
    readonly flags: Bitmask
  ) { }

  async pack() {
    return await this.cell().pack()
  }

  cell() {
    const binary = Cursor.allocUnsafe(PAYLOAD_LEN)

    binary.writeNulledString(this.address)
    binary.writeUint32(this.flags.n)
    binary.fill()

    return new RelayCell(this.circuit, this.stream, this.#class.rcommand, binary.before)
  }

  static uncell(cell: RelayCell) {
    if (cell.rcommand !== this.rcommand)
      throw new InvalidRelayCommand(this.name, cell.rcommand)
    if (!cell.stream)
      throw new InvalidStream(this.name, cell.stream)

    const binary = new Cursor(cell.data)

    const address = binary.readNulledString()
    const flagsn = binary.readUint32()
    const flags = new Bitmask(flagsn)

    return new this(cell.circuit, cell.stream, address, flags)
  }
}