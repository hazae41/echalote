import { Cursor } from "@hazae41/binary";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { InvalidRelayCommand, InvalidStream } from "mods/tor/binary/cells/errors.js";
import { Circuit } from "mods/tor/circuit.js";

export class RelayExtended2Cell {
  readonly #class = RelayExtended2Cell

  static rcommand = 15

  constructor(
    readonly circuit: Circuit,
    readonly stream: undefined,
    readonly data: Uint8Array
  ) { }

  cell(): RelayCell {
    throw new Error(`Unimplemented`)
  }

  static uncell(cell: RelayCell) {
    if (cell.rcommand !== this.rcommand)
      throw new InvalidRelayCommand(this.name, cell.rcommand)
    if (cell.stream)
      throw new InvalidStream(this.name, cell.stream)

    const cursor = new Cursor(cell.data)

    const length = cursor.readUint16()
    const data = cursor.read(length)

    return new this(cell.circuit, cell.stream, data)
  }
}