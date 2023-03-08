import { Cursor, Opaque, Writable } from "@hazae41/binary";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { InvalidRelayCommand } from "mods/tor/binary/cells/errors.js";
import { SecretCircuit } from "mods/tor/circuit.js";
import { TorStreamDuplex } from "mods/tor/stream.js";

export class RelayDropCell<T extends Writable> {
  readonly #class = RelayDropCell

  static rcommand = 10

  constructor(
    readonly circuit: SecretCircuit,
    readonly stream: TorStreamDuplex | undefined,
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

    return new this(cell.circuit, cell.stream, cell.data)
  }
}