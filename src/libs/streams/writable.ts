export class SuperWritableStream<W> {

  readonly sink: SuperUnderlyingSink<W>

  closed?: { reason?: any }

  constructor(
    readonly subsink: UnderlyingSink<W>,
    readonly strategy?: QueuingStrategy<W>
  ) {
    this.sink = new SuperUnderlyingSink(subsink)
  }

  start() {
    const { sink, strategy } = this
    return new WritableStream(sink, strategy)
  }

  error(reason?: any) {
    this.sink.controller.error(reason)
  }

  get signal() {
    return this.sink.controller.signal
  }

}

export class SuperUnderlyingSink<W> implements UnderlyingSink<W> {

  #controller?: WritableStreamDefaultController

  constructor(
    readonly subsink: UnderlyingSink<W>
  ) { }

  get controller() {
    return this.#controller!
  }

  start(controller: WritableStreamDefaultController) {
    this.#controller = controller

    return this.subsink.start?.(controller)
  }

  write(chunk: W, controller: WritableStreamDefaultController) {
    return this.subsink.write?.(chunk, controller)
  }

  abort(reason?: any) {
    return this.subsink.abort?.(reason)
  }

  close() {
    return this.subsink.close?.()
  }

}