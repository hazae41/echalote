import { Event } from "./event.js"

export interface AbortEvent extends Event {
  readonly target: AbortSignal
  readonly currentTarget: AbortSignal
}