export namespace Events {

  export function clone(event: Event) {
    if (event instanceof MessageEvent) {
      const { data, cancelable } = event
      return new MessageEvent(event.type, { data, cancelable })
    }

    if (event instanceof CloseEvent) {
      const { code, reason, wasClean, cancelable } = event
      return new CloseEvent(event.type, { code, reason, wasClean, cancelable })
    }

    if (event instanceof ErrorEvent) {
      const { error, message, cancelable } = event
      return new ErrorEvent(event.type, { error, message, cancelable })
    }

    const { cancelable } = event
    return new Event(event.type, { cancelable })
  }

  export function error(error: unknown, message?: string): Error {
    if (error instanceof Error)
      return error
    if (error instanceof ErrorEvent)
      return Events.error(error.error, error.message)
    if (error instanceof MessageEvent)
      return new Error(message ?? error.type, { cause: error.data })
    if (error instanceof Event)
      return new Error(message ?? error.type, { cause: error })
    return new Error(message ?? typeof error, { cause: error })
  }

}