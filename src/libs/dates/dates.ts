export namespace Dates {

  export function fromMillis(millis: number) {
    return new Date(millis)
  }

  export function toMillis(date: Date) {
    return date.getTime()
  }

  export function fromSeconds(seconds: number) {
    return fromMillis(seconds * 1000)
  }

  export function toSeconds(date: Date) {
    return Math.floor(toMillis(date) / 1000)
  }

  export function fromMillisDelay(millis: number) {
    return fromMillis(Date.now() + millis)
  }

  export function toMillisDelay(date: Date) {
    return toMillis(date) - Date.now()
  }

  export function fromSecondsDelay(seconds: number) {
    return fromMillisDelay(seconds * 1000)
  }

  export function toSecondsDelay(date: Date) {
    return Math.floor(toMillisDelay(date) / 1000)
  }

}