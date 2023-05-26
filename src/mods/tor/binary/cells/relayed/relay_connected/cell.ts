import { Cursor, Opaque } from "@hazae41/binary"
import { Dates } from "libs/dates/dates.js"
import { Address4, Address6 } from "mods/tor/binary/address.js"
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js"
import { InvalidRelayCommand, InvalidStream } from "mods/tor/binary/cells/errors.js"
import { SecretCircuit } from "mods/tor/circuit.js"
import { SecretTorStreamDuplex } from "mods/tor/stream.js"

export class RelayConnectedCell {
  readonly #class = RelayConnectedCell

  static rcommand = 4

  constructor(
    readonly circuit: SecretCircuit,
    readonly stream: SecretTorStreamDuplex,
    readonly address: Address4 | Address6,
    readonly ttl: Date
  ) { }

  get rcommand() {
    return this.#class.rcommand
  }

  static read(cursor: Cursor) {
    const ipv4 = Address4.read(cursor)

    if (ipv4.address !== "0.0.0.0") {
      const ttl = Dates.fromSecondsDelay(cursor.readUint32())

      return { address: ipv4, ttl }
    } else {
      const type = cursor.readUint8()

      if (type !== 6)
        throw new Error(`Unknown address type ${type}`)

      const ipv6 = Address6.read(cursor)
      const ttl = Dates.fromSecondsDelay(cursor.readUint32())

      return { address: ipv6, ttl }
    }
  }

  static uncell(cell: RelayCell<Opaque>) {
    if (cell.rcommand !== this.rcommand)
      throw new InvalidRelayCommand(this.name, cell.rcommand)
    if (!cell.stream)
      throw new InvalidStream(this.name, cell.stream)

    const { address, ttl } = cell.fragment.into(this)
    return new this(cell.circuit, cell.stream, address, ttl)
  }
}