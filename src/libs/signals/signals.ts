export namespace AbortSignals {

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