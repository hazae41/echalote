import { Binary } from "libs/binary.js"
import { ttlToDate } from "libs/time.js"
import { Address4, Address6 } from "mods/tor/binary/address.js"
import { RelayCell } from "mods/tor/binary/cells/direct/relay.js"
import { InvalidRelayCommand, InvalidStream } from "mods/tor/binary/cells/errors.js"
import { Circuit } from "mods/tor/circuit.js"
import { TcpStream } from "mods/tor/streams/tcp.js"

export class RelayConnectedCell {
  readonly class = RelayConnectedCell

  static rcommand = 4

  constructor(
    readonly circuit: Circuit,
    readonly stream: TcpStream,
    readonly address: Address4 | Address6,
    readonly ttl: Date
  ) { }

  async pack() {
    return await this.cell().pack()
  }

  cell(): RelayCell {
    throw new Error(`Unimplemented`)
  }

  static uncell(cell: RelayCell) {
    if (cell.rcommand !== this.rcommand)
      throw new InvalidRelayCommand(this.name, cell.rcommand)
    if (!cell.stream)
      throw new InvalidStream(this.name, cell.stream)

    const binary = new Binary(cell.data)

    const ipv4 = Address4.read(binary)

    if (ipv4.address !== "...") {
      const ttl = ttlToDate(binary.readUint32())
      return new this(cell.circuit, cell.stream, ipv4, ttl)
    }

    const type = binary.readUint8()

    if (type !== 6)
      throw new Error(`Unknown address type ${type}`)

    const ipv6 = Address6.read(binary)
    const ttl = ttlToDate(binary.readUint32())
    return new this(cell.circuit, cell.stream, ipv6, ttl)
  }
}