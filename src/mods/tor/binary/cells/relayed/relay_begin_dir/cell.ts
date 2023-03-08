import { Cursor, Opaque } from "@hazae41/binary";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { InvalidRelayCommand, InvalidStream } from "mods/tor/binary/cells/errors.js";
import { SecretCircuit } from "mods/tor/circuit.js";
import { SecretTorStreamDuplex } from "mods/tor/stream.js";

export class RelayBeginDirCell {
  readonly #class = RelayBeginDirCell

  static rcommand = 13

  constructor(
    readonly circuit: SecretCircuit,
    readonly stream: SecretTorStreamDuplex
  ) { }

  get rcommand() {
    return this.#class.rcommand
  }

  size() {
    return 0
  }

  write(cursor: Cursor) {
    cursor.fill(0, cursor.remaining)
  }

  static uncell(cell: RelayCell<Opaque>) {
    if (cell.rcommand !== this.rcommand)
      throw new InvalidRelayCommand(this.name, cell.rcommand)
    if (!cell.stream)
      throw new InvalidStream(this.name, cell.stream)

    return new this(cell.circuit, cell.stream)
  }
}