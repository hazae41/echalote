export type CellError =
  | InvalidCellError
  | InvalidCommandError
  | UnknownCircuitError
  | ExpectedCircuitError
  | UnexpectedCircuitError

export type RelayCellError =
  | InvalidRelayCommandError
  | UnknownStreamError
  | ExpectedStreamError
  | UnexpectedStreamError

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

export class InvalidRelayCommandError extends Error {
  readonly #class = InvalidRelayCommandError
  readonly name = this.#class.name

  constructor() {
    super(`Invalid relay command`)
  }

}


export class UnknownCircuitError extends Error {
  readonly #class = UnknownCircuitError
  readonly name = this.#class.name

  constructor() {
    super(`Unknown circuit`)
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

export class UnknownStreamError extends Error {
  readonly #class = UnknownStreamError
  readonly name = this.#class.name

  constructor() {
    super(`Unknown stream`)
  }

}

export class ExpectedStreamError extends Error {
  readonly #class = ExpectedStreamError
  readonly name = this.#class.name

  constructor() {
    super(`Expected a stream`)
  }

}

export class UnexpectedStreamError extends Error {
  readonly #class = UnexpectedStreamError
  readonly name = this.#class.name

  constructor() {
    super(`Unexpected a stream`)
  }

}