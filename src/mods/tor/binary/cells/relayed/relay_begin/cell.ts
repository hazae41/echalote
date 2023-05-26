import { Cursor, Opaque } from "@hazae41/binary";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/index.js";
import { InvalidRelayCommand, InvalidStream } from "mods/tor/binary/cells/errors.js";
import { SecretCircuit } from "mods/tor/circuit.js";
import { SecretTorStreamDuplex } from "mods/tor/stream.js";

export class RelayBeginCell {
  readonly #class = RelayBeginCell

  static rcommand = 1

  static flags = {
    IPV6_OK: 0,
    IPV4_NOT_OK: 1,
    IPV6_PREFER: 2
  }

  constructor(
    readonly circuit: SecretCircuit,
    readonly stream: SecretTorStreamDuplex,
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

    const { address, flags } = cell.fragment.into(this)
    return new this(cell.circuit, cell.stream, address, flags)
  }
}