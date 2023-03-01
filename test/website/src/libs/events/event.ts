export class Event extends globalThis.Event {

  readonly type: string
  readonly cancellable?: boolean

  constructor(type: string, eventInitDict: EventInit) {
    super(type, eventInitDict)

    this.type = type

    const {
      cancelable = false
    } = eventInitDict

    this.cancellable = cancelable
  }

}