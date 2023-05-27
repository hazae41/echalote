export namespace AbortSignals {

  export function timeout(delay: number, parent?: AbortSignal) {
    const signal = AbortSignal.timeout(delay)

    if (parent === undefined)
      return signal

    return merge(signal, parent)
  }

  export function merge(a: AbortSignal, b: AbortSignal) {
    const c = new AbortController()

    const onAbort = (reason?: unknown) => {
      c.abort(reason)

      a.removeEventListener("abort", onAbort)
      b.removeEventListener("abort", onAbort)
    }

    a.addEventListener("abort", onAbort, { passive: true })
    b.addEventListener("abort", onAbort, { passive: true })

    return c.signal
  }

}