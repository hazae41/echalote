export class InvalidCellError extends Error {
  readonly #class = InvalidCellError
  readonly name = this.#class.name

  constructor() {
    super(`Invalid cell`)
  }

}

export class InvalidCommandError extends Error {
  readonly #class = InvalidCommandError
  readonly name = this.#class.name

  constructor() {
    super(`Invalid command`)
  }

}

export class InvalidCircuitError extends Error {
  readonly #class = InvalidCircuitError
  readonly name = this.#class.name

  constructor() {
    super(`Invalid circuit`)
  }

}

export class InvalidStreamError extends Error {
  readonly #class = InvalidStreamError
  readonly name = this.#class.name

  constructor() {
    super(`Invalid stream`)
  }

}