import { CloseEvent } from "./close.js"
import { ErrorEvent } from "./error.js"

export namespace Events {

  export function clone<T>(event: MessageEvent<T>): MessageEvent<T>
  export function clone(event: CloseEvent): CloseEvent
  export function clone(event: ErrorEvent): ErrorEvent
  export function clone(event: Event): Event
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

}