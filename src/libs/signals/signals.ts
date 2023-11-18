export namespace AbortSignals {

  export function never() {
    return new AbortController().signal
  }

  export function timeout(delay: number, parent?: AbortSignal) {
    return merge(AbortSignal.timeout(delay), parent)
  }

  export function merge(a: AbortSignal, b?: AbortSignal) {
    if (b == null)
      return a

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