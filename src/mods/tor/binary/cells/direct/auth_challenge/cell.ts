import { BinaryReadError, Opaque, Readable } from "@hazae41/binary"
import { Bytes } from "@hazae41/bytes"
import { Cursor } from "@hazae41/cursor"
import { Ok, Result } from "@hazae41/result"
import { Cell } from "mods/tor/binary/cells/cell.js"
import { SecretCircuit } from "mods/tor/circuit.js"

export interface AuthChallengeCellInit {
  readonly challenge: Bytes<32>,
  readonly methods: number[]
}

export class AuthChallengeCell {
  readonly #class = AuthChallengeCell

  static command = 130

  constructor(
    readonly circuit: undefined,
    readonly challenge: Bytes<32>,
    readonly methods: number[]
  ) { }

  static init(circuit: undefined, init: AuthChallengeCellInit) {
    const { challenge, methods } = init

    return new AuthChallengeCell(circuit, challenge, methods)
  }

  get command() {
    return this.#class.command
  }

  static tryRead(cursor: Cursor): Result<AuthChallengeCellInit, BinaryReadError> {
    return Result.unthrowSync(t => {
      const challenge = cursor.tryRead(32).throw(t)
      const nmethods = cursor.tryReadUint16().throw(t)
      const methods = new Array<number>(nmethods)

      for (let i = 0; i < nmethods; i++)
        methods[i] = cursor.tryReadUint16().throw(t)

      return new Ok({ challenge, methods })
    })
  }

}

export interface Uncellable<UncellInit, UncellOutput, ReadError> extends Readable<UncellInit, ReadError> {
  readonly command: number

  init(circuit: SecretCircuit | undefined, init: UncellInit): UncellOutput
}

export namespace Uncellable {

  export interface Circuitless<UncellInit, UncellOutput, ReadError> extends Readable<UncellInit, ReadError> {
    readonly command: number

    init(circuit: undefined, init: UncellInit): UncellOutput
  }

  export interface Circuitful<UncellInit, UncellOutput, ReadError> extends Readable<UncellInit, ReadError> {
    readonly command: number

    init(circuit: SecretCircuit, init: UncellInit): UncellOutput
  }

  export function tryUncell<UncellInit, UncellOutput, ReadError>(uncellable: Uncellable<UncellInit, UncellOutput, ReadError>, cell: Cell<Opaque>): Result<UncellOutput, ReadError | BinaryReadError> {
    const { command, circuit } = cell

    if (command !== uncellable.command)
      throw new Error(`Invalid cell command`)

    return cell.payload.tryInto(uncellable).mapSync(init => uncellable.init(circuit, init))
  }

  export function tryUncellCircuitful<UncellInit, UncellOutput, ReadError>(uncellable: Circuitful<UncellInit, UncellOutput, ReadError>, cell: Cell<Opaque>): Result<UncellOutput, ReadError | BinaryReadError> {
    const { command, circuit } = cell

    if (command !== uncellable.command)
      throw new Error(`Invalid cell command`)
    if (circuit === undefined)
      throw new Error(`Unexpected circuit`)

    return cell.payload.tryInto(uncellable).mapSync(init => uncellable.init(circuit, init))
  }

  export function tryUncellCircuitless<UncellInit, UncellOutput, ReadError>(uncellable: Circuitless<UncellInit, UncellOutput, ReadError>, cell: Cell<Opaque>): Result<UncellOutput, ReadError | BinaryReadError> {
    const { command, circuit } = cell

    if (command !== uncellable.command)
      throw new Error(`Invalid cell command`)
    if (circuit !== undefined)
      throw new Error(`Unexpected circuit`)

    return cell.payload.tryInto(uncellable).mapSync(init => uncellable.init(circuit, init))
  }

} 