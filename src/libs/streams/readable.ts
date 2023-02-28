export class SuperReadableStream<R>  {

  readonly source: SuperUnderlyingDefaultSource<R>

  closed?: { reason?: any }

  constructor(
    readonly subsource: UnderlyingDefaultSource<R>,
    readonly strategy?: QueuingStrategy<R>
  ) {
    this.source = new SuperUnderlyingDefaultSource(subsource)
  }

  start() {
    const { source, strategy } = this
    return new ReadableStream(source, strategy)
  }

  enqueue(chunk?: R) {
    this.source.controller.enqueue(chunk)
  }

  error(reason?: any) {
    this.source.controller.error(reason)
  }

  close() {
    this.source.controller.close()
  }

}

export class SuperUnderlyingDefaultSource<R> implements UnderlyingDefaultSource<R> {

  #controller?: ReadableStreamDefaultController<R>

  constructor(
    readonly subsource: UnderlyingDefaultSource<R>
  ) { }

  get controller() {
    return this.#controller!
  }

  start(controller: ReadableStreamDefaultController<R>) {
    this.#controller = controller

    return this.subsource.start?.(controller)
  }

  pull(controller: ReadableStreamDefaultController<R>) {
    return this.subsource.start?.(controller)
  }

  cancel(reason?: any) {
    return this.subsource.cancel?.(reason)
  }

}