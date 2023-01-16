export class Future<T = unknown, E = unknown> {

  readonly ok: (x: T) => void
  readonly err: (e: E) => void

  readonly promise: Promise<T>

  /**
   * A promise that's manually fullfilled or rejected
   */
  constructor() {
    let ok: (x: T) => void
    let err: (e: E) => void

    this.promise = new Promise((pok, perr) => {
      ok = pok
      err = perr
    })

    this.ok = ok!
    this.err = err!
  }
}
