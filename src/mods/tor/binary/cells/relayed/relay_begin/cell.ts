import { Cursor } from "@hazae41/binary";
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
    readonly flags: number
  ) { }

  async pack() {
    return await this.cell().pack()
  }

  cell() {
    const cursor = Cursor.allocUnsafe(PAYLOAD_LEN)

    cursor.writeNulledString(this.address)
    cursor.writeUint32(this.flags)
    cursor.fill()

    return new RelayCell(this.circuit, this.stream, this.#class.rcommand, cursor.before)
  }

  static uncell(cell: RelayCell) {
    if (cell.rcommand !== this.rcommand)
      throw new InvalidRelayCommand(this.name, cell.rcommand)
    if (!cell.stream)
      throw new InvalidStream(this.name, cell.stream)

    const cursor = new Cursor(cell.data)

    const address = cursor.readNulledString()
    const flags = cursor.readUint32()

    return new this(cell.circuit, cell.stream, address, flags)
  }
}