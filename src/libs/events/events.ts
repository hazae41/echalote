import { Future } from "@hazae41/future"
import { AbortEvent } from "./abort.js"
import { AsyncEventTarget } from "./target.js"

export type CloseAndErrorEvents = {
  close: CloseEvent,
  error: ErrorEvent
}

export namespace Events {

  /**
   * Short variant of `waitFor` that does not filter nor map the event
   * @param target 
   * @param type 
   * @param signal 
   * @returns 
   */
  export async function wait<E extends CloseAndErrorEvents, K extends keyof E>(target: AsyncEventTarget<E>, type: K, signal?: AbortSignal) {
    const future = new Future<E[K]>()
    const onEvent = (event: E[K]) => future.resolve(event)
    return await waitFor(target, type, { future, onEvent, signal })
  }

  export interface WaitForParams<T, E extends CloseAndErrorEvents, K extends keyof E> {
    onEvent: (event: E[K]) => void,
    future: Future<T>,
    signal?: AbortSignal
  }

  /**
   * Safely wait for the given event type, throwing when a close or error event happens, and finally cleaning the listeners, while allowing mapping or filtering events based on the given function
   * @param target 
   * @param type 
   * @param params 
   * @returns 
   */
  export async function waitFor<T, E extends CloseAndErrorEvents, K extends keyof E>(target: AsyncEventTarget<E>, type: K, params: WaitForParams<T, E, K>) {
    const { future, onEvent, signal } = params

    const onAbort = (event: Event) => {
      const abortEvent = event as AbortEvent
      const error = new Error(`Aborted`, { cause: abortEvent.target.reason })
      future.reject(error)
    }

    const onClose = (event: CloseEvent) => {
      const error = new Error(`Closed`, { cause: event })
      future.reject(error)
    }

    const onError = (event: ErrorEvent) => {
      const error = new Error(`Errored`, { cause: event })
      future.reject(error)
    }

    try {
      signal?.addEventListener("abort", onAbort, { passive: true })
      target.addEventListener("close", onClose, { passive: true })
      target.addEventListener("error", onError, { passive: true })
      target.addEventListener(type, onEvent, { passive: true })

      return await future.promise
    } finally {
      signal?.removeEventListener("abort", onAbort)
      target.removeEventListener("close", onClose)
      target.removeEventListener("error", onError)
      target.removeEventListener(type, onEvent)
    }
  }

}