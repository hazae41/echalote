import { Event } from "./event.js";

export class CloseEvent extends Event implements globalThis.CloseEvent {

  readonly code: number
  readonly reason: string;
  readonly wasClean: boolean

  constructor(type: string, eventInitDict: CloseEventInit) {
    super(type, eventInitDict)

    const {
      code = 0,
      reason = "",
      wasClean = false
    } = eventInitDict

    this.code = code
    this.reason = reason
    this.wasClean = wasClean
  }

}