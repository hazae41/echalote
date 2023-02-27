import { Cursor, Opaque, Writable } from "@hazae41/binary";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { InvalidRelayCommand, InvalidStream } from "mods/tor/binary/cells/errors.js";
import { Circuit } from "mods/tor/circuit.js";

export class RelayExtended2Cell<T extends Writable> {
  readonly #class = RelayExtended2Cell

  static rcommand = 15

  constructor(
    readonly circuit: Circuit,
    readonly stream: undefined,
    readonly data: T
  ) { }

  get rcommand() {
    return this.#class.rcommand
  }

  static read(cursor: Cursor) {
    const length = cursor.readUint16()
    const bytes = cursor.read(length)
    const data = new Opaque(bytes)

    return { data }
  }

  static uncell(cell: RelayCell<Opaque>) {
    if (cell.rcommand !== this.rcommand)
      throw new InvalidRelayCommand(this.name, cell.rcommand)
    if (cell.stream)
      throw new InvalidStream(this.name, cell.stream)

    const { data } = cell.data.into(this)
    return new this(cell.circuit, cell.stream, data)
  }
}