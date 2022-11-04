/**
 * Promise that's manually fullfilled or rejected
 */
export class Future<T = any, E = any> {
  readonly class = Future

  readonly ok: (x: T) => void
  readonly err: (e: E) => void

  readonly promise: Promise<T>

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
