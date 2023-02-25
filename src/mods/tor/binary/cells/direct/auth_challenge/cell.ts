import { Cursor, Opaque } from "@hazae41/binary"
import { Cell } from "mods/tor/binary/cells/cell.js"

export class AuthChallengeCell {
  readonly #class = AuthChallengeCell

  static command = 130

  constructor(
    readonly circuit: undefined,
    readonly challenge: Uint8Array,
    readonly methods: number[]
  ) { }

  get command() {
    return this.#class.command
  }

  size(): number {
    throw new Error(`Unimplemented`)
  }

  write(cursor: Cursor) {
    throw new Error(`Unimplemented`)
  }

  static read(cursor: Cursor) {
    const challenge = cursor.read(32)
    const nmethods = cursor.readUint16()
    const methods = new Array<number>(nmethods)

    for (let i = 0; i < nmethods; i++)
      methods[i] = cursor.readUint16()

    return { challenge, methods }
  }

  static uncell(cell: Cell<Opaque>) {
    if (cell.command !== this.command)
      throw new Error(`Invalid ${this.name} cell command ${cell.command}`)
    if (cell.circuit)
      throw new Error(`Unexpected circuit for ${this.name} cell`)

    const { challenge, methods } = cell.payload.into(this)
    return new this(cell.circuit, challenge, methods)
  }

}