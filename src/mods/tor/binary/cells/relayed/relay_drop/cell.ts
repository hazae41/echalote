import { Cursor, Opaque } from "@hazae41/binary";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { InvalidRelayCommand } from "mods/tor/binary/cells/errors.js";
import { Circuit } from "mods/tor/circuit.js";
import { TcpStream } from "mods/tor/streams/tcp.js";

export class RelayDropCell {
  readonly #class = RelayDropCell

  static rcommand = 10

  constructor(
    readonly circuit: Circuit,
    readonly stream: TcpStream | undefined,
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

    return new this(cell.circuit, cell.stream, cell.data.bytes)
  }
}