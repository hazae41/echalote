import { Cursor, Opaque } from "@hazae41/binary";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/index.js";
import { InvalidRelayCommand, InvalidStream } from "mods/tor/binary/cells/errors.js";
import { Circuit } from "mods/tor/circuit.js";
import { TorStreamDuplex } from "mods/tor/stream.js";

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
    readonly stream: TorStreamDuplex,
    readonly address: string,
    readonly flags: number
  ) { }

  get rcommand() {
    return this.#class.rcommand
  }

  size() {
    return (this.address.length + 1) + 4
  }

  write(cursor: Cursor) {
    cursor.writeNulledString(this.address)
    cursor.writeUint32(this.flags)
  }

  static read(cursor: Cursor) {
    const address = cursor.readNulledString()
    const flags = cursor.readUint32()

    return { address, flags }
  }

  static uncell(cell: RelayCell<Opaque>) {
    if (cell.rcommand !== this.rcommand)
      throw new InvalidRelayCommand(this.name, cell.rcommand)
    if (!cell.stream)
      throw new InvalidStream(this.name, cell.stream)

    const { address, flags } = cell.data.into(this)
    return new this(cell.circuit, cell.stream, address, flags)
  }
}