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

export class TooManyRetriesError extends Error {
  readonly #class = TooManyRetriesError
  readonly name = this.#class.name

  constructor() {
    super(`Too many retries`)
  }

}