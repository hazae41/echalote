import { Cursor, Opaque } from "@hazae41/binary";
import { DestroyCell } from "mods/tor/binary/cells/direct/destroy/cell.js";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { InvalidRelayCommand, InvalidStream } from "mods/tor/binary/cells/errors.js";
import { Circuit } from "mods/tor/circuit.js";

export class RelayTruncateCell {
  readonly #class = RelayTruncateCell

  static rcommand = 8

  static reasons = DestroyCell.reasons

  constructor(
    readonly circuit: Circuit,
    readonly stream: undefined,
    readonly reason: number
  ) { }

  get rcommand() {
    return this.#class.rcommand
  }

  size() {
    return 1
  }

  write(cursor: Cursor) {
    cursor.writeUint8(this.reason)
  }

  static uncell(cell: RelayCell<Opaque>) {
    if (cell.rcommand !== this.rcommand)
      throw new InvalidRelayCommand(this.name, cell.rcommand)
    if (cell.stream)
      throw new InvalidStream(this.name, cell.stream)

    const cursor = new Cursor(cell.data.bytes)

    const reason = cursor.readUint8()

    return new this(cell.circuit, cell.stream, reason)
  }
}