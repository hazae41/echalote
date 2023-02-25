import { Cursor, Opaque } from "@hazae41/binary"
import { OldCell } from "mods/tor/binary/cells/cell.js"
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js"

export class VersionsCell {
  readonly #class = VersionsCell

  static command = 7

  constructor(
    readonly circuit: undefined,
    readonly versions: number[]
  ) { }

  get command() {
    return this.#class.command
  }

  size() {
    return 2 * this.versions.length
  }

  write(cursor: Cursor) {
    for (const version of this.versions)
      cursor.writeUint16(version)
  }

  static uncell(cell: OldCell<Opaque>) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    const cursor = new Cursor(cell.payload.bytes)

    const nversions = cell.payload.bytes.length / 2
    const versions = new Array<number>(nversions)

    for (let i = 0; i < nversions; i++)
      versions[i] = cursor.readUint16()

    return new this(cell.circuit, versions)
  }

}