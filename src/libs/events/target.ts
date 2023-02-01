
export type AsyncEventListener =
  (e: Event) => void | Promise<void>

export type AddAsyncEventListenerOptions = {
  once?: boolean
  passive?: boolean
  signal?: AbortSignal
}

type EventListenerOptions = {
  once?: boolean
  passive?: boolean
  signal?: AbortSignal,
  onabort: () => void
}

export class AsyncEventTarget {
  readonly #listeners = new Map<string, Map<AsyncEventListener, EventListenerOptions>>()

  #get(type: string) {
    const listeners = this.#listeners.get(type)
    if (listeners !== undefined) return listeners

    const listeners2 = new Map<AsyncEventListener, EventListenerOptions>()
    this.#listeners.set(type, listeners2)

    return listeners2
  }

  /**
   * Add a listener to an event
   * @param type Event type //  "abort", "error", "message", "close"
   * @param listener Event listener // (e) => console.log("hello")
   * @param options Options // { passive: true }
   * @returns 
   */
  addEventListener(type: string, listener: AsyncEventListener | null, options: AddAsyncEventListenerOptions = {}) {
    if (!listener) return

    const listeners = this.#get(type)

    const onabort = () => this.removeEventListener(type, listener)
    const options2 = { ...options, onabort }

    listeners.set(listener, options2)

    options.signal?.addEventListener("abort", onabort)
  }

  /**
   * Remove a listener from an event
   * @param type Event type //  "abort", "error", "message", "close"
   * @param listener Event listener // (e) => console.log("hello")
   * @param _ Just to look like DOM's EventTarget
   * @returns 
   */
  removeEventListener(type: string, listener: AsyncEventListener | null, _: {} = {}) {
    if (!listener) return

    const listeners = this.#get(type)

    const options = listeners.get(listener)
    if (!options) return

    options.signal?.removeEventListener("abort", options.onabort)

    listeners.delete(listener)

    if (listeners.size) return
    this.#listeners.delete(type)
  }

  /**
   * Dispatch an event to its listeners
   * 
   * - Dispatch to active listeners sequencially
   * - Return false if the event has been cancelled
   * - Dispatch to passive listeners concurrently
   * - Return true
   * @param event Event
   * @returns 
   */
  async dispatchEvent(event: Event) {
    const { type } = event

    const listeners = this.#listeners.get(type)

    if (!listeners) return true

    for (const [listener, options] of listeners) {
      if (options.passive) continue

      const onsettle = () => {
        if (!options.once) return

        this.removeEventListener(type, listener)
      }

      try {
        await listener(event)
      } finally {
        onsettle()
      }
    }

    if (event.cancelable && event.defaultPrevented)
      return false

    const promises = new Array<Promise<void>>(listeners.size)

    for (const [listener, options] of listeners) {
      if (!options.passive) continue

      const onsettle = () => {
        if (!options.once) return

        this.removeEventListener(type, listener)
      }

      const promise = listener(event)

      if (promise)
        promises.push(promise.finally(onsettle))
      else
        onsettle()
    }

    await Promise.all(promises)

    return true
  }
}