export class ExpiredCertError extends Error {
  readonly #class = ExpiredCertError
  readonly name = this.#class.name

  constructor() {
    super(`Expired certificate`)
  }

}

export class PrematureCertError extends Error {
  readonly #class = PrematureCertError
  readonly name = this.#class.name

  constructor() {
    super(`Premature certificate`)
  }

}