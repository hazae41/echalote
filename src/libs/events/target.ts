export type AsyncEventListener<T = unknown> =
  (e: T) => void | Promise<void>

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

export class AsyncEventTarget<E extends { [P: string]: Event }> {
  readonly #listeners = new Map<keyof E, Map<AsyncEventListener, EventListenerOptions>>()

  constructor() { }

  #get<K extends keyof E>(type: K) {
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
  addEventListener<K extends keyof E>(type: K, listener: AsyncEventListener<E[K]> | null, options: AddAsyncEventListenerOptions = {}) {
    if (!listener) return

    const listeners = this.#get(type)

    const onabort = () => this.removeEventListener(type, listener)
    const options2 = { ...options, onabort }

    listeners.set(listener as AsyncEventListener, options2)

    options.signal?.addEventListener("abort", onabort, { passive: true })
  }

  /**
   * Remove a listener from an event
   * @param type Event type //  "abort", "error", "message", "close"
   * @param listener Event listener // (e) => console.log("hello")
   * @param _ Just to look like DOM's EventTarget
   * @returns 
   */
  removeEventListener<K extends keyof E>(type: K, listener: AsyncEventListener<E[K]> | null, _: {} = {}) {
    if (!listener) return

    const listeners = this.#get(type)

    const options = listeners.get(listener as AsyncEventListener)
    if (!options) return

    options.signal?.removeEventListener("abort", options.onabort)

    listeners.delete(listener as AsyncEventListener)

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
  async dispatchEvent<K extends keyof E>(event: E[K], type: K /*= event.type as K*/) {
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