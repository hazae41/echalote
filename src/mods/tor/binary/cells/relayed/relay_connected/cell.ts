import { Cursor, Opaque } from "@hazae41/binary"
import { ttlToDate } from "libs/time.js"
import { Address4, Address6 } from "mods/tor/binary/address.js"
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js"
import { InvalidRelayCommand, InvalidStream } from "mods/tor/binary/cells/errors.js"
import { Circuit } from "mods/tor/circuit.js"
import { TorStreamDuplex } from "mods/tor/stream.js"

export class RelayConnectedCell {
  readonly #class = RelayConnectedCell

  static rcommand = 4

  constructor(
    readonly circuit: Circuit,
    readonly stream: TorStreamDuplex,
    readonly address: Address4 | Address6,
    readonly ttl: Date
  ) { }

  get rcommand() {
    return this.#class.rcommand
  }

  static read(cursor: Cursor) {
    const ipv4 = Address4.read(cursor)

    if (ipv4.address !== "...") {
      const ttl = ttlToDate(cursor.readUint32())
      return { address: ipv4, ttl }
    }

    const type = cursor.readUint8()

    if (type !== 6)
      throw new Error(`Unknown address type ${type}`)

    const ipv6 = Address6.read(cursor)
    const ttl = ttlToDate(cursor.readUint32())

    return { address: ipv6, ttl }
  }

  static uncell(cell: RelayCell<Opaque>) {
    if (cell.rcommand !== this.rcommand)
      throw new InvalidRelayCommand(this.name, cell.rcommand)
    if (!cell.stream)
      throw new InvalidStream(this.name, cell.stream)

    const { address, ttl } = cell.data.into(this)
    return new this(cell.circuit, cell.stream, address, ttl)
  }
}