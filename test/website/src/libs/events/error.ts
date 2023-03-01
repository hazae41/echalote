import { Event } from "./event.js"

export class ErrorEvent extends Event implements globalThis.ErrorEvent {

  readonly error: any
  readonly message: string
  readonly colno: number
  readonly filename: string
  readonly lineno: number

  constructor(type: string, eventInitDict: ErrorEventInit) {
    super(type, eventInitDict)

    const {
      error,
      message = "",
      colno = 0,
      filename = "",
      lineno = 0
    } = eventInitDict

    this.error = error
    this.message = message
    this.colno = colno
    this.filename = filename
    this.lineno = lineno
  }

}