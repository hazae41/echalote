import { Cursor, Opaque } from "@hazae41/binary";
import { TypedAddress } from "mods/tor/binary/address.js";
import { Cell } from "mods/tor/binary/cells/cell.js";
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js";

export class NetinfoCell {
  readonly #class = NetinfoCell

  static command = 8

  constructor(
    readonly circuit: undefined,
    readonly time: number,
    readonly other: TypedAddress,
    readonly owneds: TypedAddress[]
  ) { }

  get command() {
    return this.#class.command
  }

  size() {
    return 4 + this.other.size() + 1 + this.owneds.reduce((p, c) => p + c.size(), 0)
  }

  write(cursor: Cursor) {
    cursor.writeUint32(this.time)
    this.other.write(cursor)
    cursor.writeUint8(this.owneds.length)

    for (const owned of this.owneds)
      owned.write(cursor)
  }

  static uncell(cell: Cell<Opaque>) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    const cursor = new Cursor(cell.payload.bytes)

    const time = cursor.readUint32()
    const other = TypedAddress.read(cursor)
    const nowneds = cursor.readUint8()
    const owneds = new Array<TypedAddress>(nowneds)

    for (let i = 0; i < nowneds; i++)
      owneds[i] = TypedAddress.read(cursor)

    return new this(cell.circuit, time, other, owneds)
  }
}