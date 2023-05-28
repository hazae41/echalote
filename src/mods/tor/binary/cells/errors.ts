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

export class ExpectedCircuitError extends Error {
  readonly #class = ExpectedCircuitError
  readonly name = this.#class.name

  constructor() {
    super(`Expected a circuit`)
  }

}

export class UnexpectedCircuitError extends Error {
  readonly #class = UnexpectedCircuitError
  readonly name = this.#class.name

  constructor() {
    super(`Unexpected a circuit`)
  }

}

export class InvalidStreamError extends Error {
  readonly #class = InvalidStreamError
  readonly name = this.#class.name

  constructor() {
    super(`Invalid stream`)
  }

}