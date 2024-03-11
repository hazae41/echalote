export class Unimplemented extends Error {
  readonly #class = Unimplemented
  readonly name = this.#class.name

  constructor() {
    super(`Unimplemented`)
  }
}

export type TorClientError =
  | InvalidTorStateError
  | InvalidTorVersionError

export class InvalidTorStateError extends Error {
  readonly #class = InvalidTorStateError
  readonly name = this.#class.name

  constructor() {
    super(`Invalid Tor state`)
  }

}

export class InvalidTorVersionError extends Error {
  readonly #class = InvalidTorVersionError
  readonly name = this.#class.name

  constructor() {
    super(`Invalid Tor version`)
  }

}