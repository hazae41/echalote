import { BinaryReadError, Opaque } from "@hazae41/binary"
import { Bytes } from "@hazae41/bytes"
import { Cursor } from "@hazae41/cursor"
import { Ok, Result } from "@hazae41/result"
import { Cell } from "mods/tor/binary/cells/cell.js"

export class AuthChallengeCell {
  readonly #class = AuthChallengeCell

  static command = 130

  constructor(
    readonly circuit: undefined,
    readonly challenge: Bytes<32>,
    readonly methods: number[]
  ) { }

  get command() {
    return this.#class.command
  }

  static tryRead(cursor: Cursor): Result<{
    challenge: Bytes<32>,
    methods: number[]
  }, BinaryReadError> {
    return Result.unthrowSync(t => {
      const challenge = cursor.tryRead(32).throw(t)
      const nmethods = cursor.tryReadUint16().throw(t)
      const methods = new Array<number>(nmethods)

      for (let i = 0; i < nmethods; i++)
        methods[i] = cursor.tryReadUint16().throw(t)

      return new Ok({ challenge, methods })
    })
  }

  static tryUncell(cell: Cell<Opaque>): Result<AuthChallengeCell, BinaryReadError> {
    const { command, circuit } = cell

    if (command !== this.command)
      throw new Error(`Invalid ${this.name} cell command ${cell.command}`)
    if (circuit)
      throw new Error(`Unexpected circuit for ${this.name} cell`)

    return cell.payload.tryInto(this).mapSync(x => new AuthChallengeCell(circuit, x.challenge, x.methods))
  }

}