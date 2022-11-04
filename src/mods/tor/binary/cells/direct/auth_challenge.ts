import { Binary } from "libs/binary.js"
import { NewCell } from "mods/tor/binary/cells/cell.js"

export class AuthChallengeCell {
  readonly class = AuthChallengeCell

  static command = 130

  constructor(
    readonly circuit: undefined,
    readonly challenge: Buffer,
    readonly methods: number[]
  ) { }

  pack() {
    return this.cell().pack()
  }

  cell(): NewCell {
    throw new Error(`Unimplemented`)
  }

  static uncell(cell: NewCell) {
    if (cell.command !== this.command)
      throw new Error(`Invalid AUTH_CHALLENGE cell command ${cell.command}`)
    if (cell.circuit)
      throw new Error(`Can't uncell DESTROY cell on circuit > 0`)

    const binary = new Binary(cell.payload)

    const challenge = binary.read(32)
    const nmethods = binary.readUint16()
    const methods = new Array<number>(nmethods)

    for (let i = 0; i < nmethods; i++)
      methods[i] = binary.readUint16()

    return new this(cell.circuit, challenge, methods)
  }
}