import { Cursor } from "@hazae41/binary";
import { TypedAddress } from "mods/tor/binary/address.js";
import { NewCell } from "mods/tor/binary/cells/cell.js";
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js";
import { PAYLOAD_LEN } from "mods/tor/constants.js";

export class NetinfoCell {
  readonly #class = NetinfoCell

  static command = 8

  constructor(
    readonly circuit: undefined,
    readonly time: number,
    readonly other: TypedAddress,
    readonly owneds: TypedAddress[]
  ) { }

  pack() {
    return this.cell().pack()
  }

  cell() {
    const cursor = Cursor.allocUnsafe(PAYLOAD_LEN)

    cursor.writeUint32(this.time)
    this.other.write(cursor)
    cursor.writeUint8(this.owneds.length)

    for (const owned of this.owneds)
      owned.write(cursor)

    cursor.fill()

    return new NewCell(this.circuit, this.#class.command, cursor.bytes)
  }

  static uncell(cell: NewCell) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    const cursor = new Cursor(cell.payload)

    const time = cursor.readUint32()
    const other = TypedAddress.read(cursor)
    const nowneds = cursor.readUint8()
    const owneds = new Array<TypedAddress>(nowneds)

    for (let i = 0; i < nowneds; i++)
      owneds[i] = TypedAddress.read(cursor)

    return new this(cell.circuit, time, other, owneds)
  }
}