import { Cursor, Opaque } from "@hazae41/binary";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { InvalidRelayCommand, InvalidStream } from "mods/tor/binary/cells/errors.js";
import { Circuit } from "mods/tor/circuit.js";
import { TcpStream } from "mods/tor/streams/tcp.js";

export class RelayDataCell {
  readonly #class = RelayDataCell

  static rcommand = 2

  constructor(
    readonly circuit: Circuit,
    readonly stream: TcpStream,
    readonly data: Uint8Array
  ) { }

  get rcommand() {
    return this.#class.rcommand
  }

  size() {
    return this.data.length
  }

  write(cursor: Cursor) {
    cursor.write(this.data)
  }

  static uncell(cell: RelayCell<Opaque>) {
    if (cell.rcommand !== this.rcommand)
      throw new InvalidRelayCommand(this.name, cell.rcommand)
    if (!cell.stream)
      throw new InvalidStream(this.name, cell.stream)

    return new this(cell.circuit, cell.stream, cell.data.bytes)
  }
}