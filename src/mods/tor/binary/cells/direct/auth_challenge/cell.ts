import { Uint8Array } from "@hazae41/bytes"
import { Cursor } from "@hazae41/cursor"
import { Unimplemented } from "@hazae41/result"

export class AuthChallengeCell {
  readonly #class = AuthChallengeCell

  static readonly old = false
  static readonly circuit = false
  static readonly command = 130

  constructor(
    readonly challenge: Uint8Array<32>,
    readonly methods: number[]
  ) { }

  get circuit() {
    return this.#class.circuit
  }

  get command() {
    return this.#class.command
  }

  sizeOrThrow(): never {
    throw new Unimplemented()
  }

  writeOrThrow(cursor: Cursor): never {
    throw new Unimplemented()
  }

  static readOrThrow(cursor: Cursor) {
    const challenge = cursor.readAndCopyOrThrow(32)
    const nmethods = cursor.readUint16OrThrow()
    const methods = new Array<number>(nmethods)

    for (let i = 0; i < nmethods; i++)
      methods[i] = cursor.readUint16OrThrow()

    return new AuthChallengeCell(challenge, methods)
  }

}
