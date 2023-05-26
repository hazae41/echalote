import { Cursor, Opaque, Writable } from "@hazae41/binary";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { InvalidRelayCommand, InvalidStream } from "mods/tor/binary/cells/errors.js";
import { SecretCircuit } from "mods/tor/circuit.js";
import { SecretTorStreamDuplex } from "mods/tor/stream.js";

export class RelayDataCell<T extends Writable> {
  readonly #class = RelayDataCell

  static rcommand = 2

  constructor(
    readonly circuit: SecretCircuit,
    readonly stream: SecretTorStreamDuplex,
    readonly data: T
  ) { }

  get rcommand() {
    return this.#class.rcommand
  }

  size() {
    return this.data.size()
  }

  write(cursor: Cursor) {
    this.data.write(cursor)
  }

  static uncell(cell: RelayCell<Opaque>) {
    if (cell.rcommand !== this.rcommand)
      throw new InvalidRelayCommand(this.name, cell.rcommand)
    if (!cell.stream)
      throw new InvalidStream(this.name, cell.stream)

    return new this(cell.circuit, cell.stream, cell.fragment)
  }
}