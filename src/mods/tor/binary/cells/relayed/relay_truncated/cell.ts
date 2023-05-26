import { Cursor, Opaque } from "@hazae41/binary";
import { DestroyCell } from "mods/tor/binary/cells/direct/destroy/cell.js";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { InvalidRelayCommand, InvalidStream } from "mods/tor/binary/cells/errors.js";
import { SecretCircuit } from "mods/tor/circuit.js";

export class RelayTruncatedCell {
  readonly #class = RelayTruncatedCell

  static rcommand = 9

  static reasons = DestroyCell.reasons

  constructor(
    readonly circuit: SecretCircuit,
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

  static read(cursor: Cursor) {
    const reason = cursor.readUint8()

    return { reason }
  }

  static uncell(cell: RelayCell<Opaque>) {
    if (cell.rcommand !== this.rcommand)
      throw new InvalidRelayCommand(this.name, cell.rcommand)
    if (cell.stream)
      throw new InvalidStream(this.name, cell.stream)

    const { reason } = cell.fragment.into(this)
    return new this(cell.circuit, cell.stream, reason)
  }
}