import { Binary } from "libs/binary.js"
import { OldCell } from "mods/tor/binary/cells/cell.js"
import { InvalidCircuit, InvalidCommand } from "mods/tor/binary/cells/errors.js"

export class VersionsCell {
  readonly #class = VersionsCell

  static command = 7

  constructor(
    readonly circuit: undefined,
    readonly versions: number[]
  ) { }

  pack() {
    return this.cell().pack()
  }

  cell() {
    const binary = Binary.allocUnsafe(this.versions.length * 2)

    for (const version of this.versions)
      binary.writeUint16(version)

    return new OldCell(this.circuit, this.#class.command, binary.buffer)
  }

  static uncell(cell: OldCell) {
    if (cell.command !== this.command)
      throw new InvalidCommand(this.name, cell.command)
    if (cell.circuit)
      throw new InvalidCircuit(this.name, cell.circuit)

    const binary = new Binary(cell.payload)

    const nversions = cell.payload.length / 2
    const versions = new Array<number>(nversions)

    for (let i = 0; i < nversions; i++)
      versions[i] = binary.readUint16()

    return new this(cell.circuit, versions)
  }

}