import { BinaryReadError } from "@hazae41/binary"
import { Bytes } from "@hazae41/bytes"
import { Cursor } from "@hazae41/cursor"
import { Ok, Panic, Result, Unimplemented } from "@hazae41/result"

export class AuthChallengeCell {
  readonly #class = AuthChallengeCell

  static readonly circuit = false
  static readonly command = 130

  constructor(
    readonly challenge: Bytes<32>,
    readonly methods: number[]
  ) { }

  get circuit() {
    return this.#class.circuit
  }

  get command() {
    return this.#class.command
  }

  trySize(): Result<never, never> {
    throw Panic.from(new Unimplemented())
  }

  tryWrite(cursor: Cursor): Result<never, never> {
    throw Panic.from(new Unimplemented())
  }

  static tryRead(cursor: Cursor): Result<AuthChallengeCell, BinaryReadError> {
    return Result.unthrowSync(t => {
      const challenge = cursor.tryRead(32).throw(t)
      const nmethods = cursor.tryReadUint16().throw(t)
      const methods = new Array<number>(nmethods)

      for (let i = 0; i < nmethods; i++)
        methods[i] = cursor.tryReadUint16().throw(t)

      return new Ok(new AuthChallengeCell(challenge, methods))
    })
  }

}
