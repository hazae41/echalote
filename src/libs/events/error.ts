export interface ErrorEvent extends Event {
  readonly error?: any
  readonly message?: string
}

export class ErrorEvent extends Event {
  readonly error?: any
  readonly message?: string

  constructor(type: string, eventInitDict: ErrorEventInit) {
    super(type, eventInitDict)

    const { error, message } = eventInitDict
    Object.assign(this, { error, message })
  }
}