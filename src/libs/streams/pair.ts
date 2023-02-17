import { AsyncEventTarget } from "libs/events/target.js"

export class StreamPair<R, W> extends AsyncEventTarget {

  readonly sink: StreamPairSink<R, W>
  readonly source: StreamPairSource<R, W>

  readonly readable: ReadableStream<R>
  readonly writable: WritableStream<W>

  constructor(
    subsource: UnderlyingSource<R>,
    subsink: UnderlyingSink<W>,
  ) {
    super()

    this.source = new StreamPairSource(this, subsource)
    this.sink = new StreamPairSink(this, subsink)

    this.readable = new ReadableStream(this.source)
    this.writable = new WritableStream(this.sink)
  }

  async enqueue(chunk?: R) {
    this.source.controller.enqueue(chunk)
  }

  async error(reason?: any) {
    this.sink.controller.error(reason)
    this.source.controller.error(reason)
  }

  async terminate() {
    this.sink.controller.error(new Error(`Closed`))
    this.source.controller.close()
  }

}

export class StreamPairSink<R, W> implements UnderlyingSink<W> {

  #controller?: WritableStreamDefaultController

  constructor(
    readonly pair: StreamPair<R, W>,
    readonly subsink: UnderlyingSink<W>
  ) { }

  get controller() {
    return this.#controller!
  }

  async start(controller: WritableStreamDefaultController) {
    this.#controller = controller
    return await this.subsink.start?.(controller)
  }

  async write(chunk: W, controller: WritableStreamDefaultController) {
    return await this.subsink.write?.(chunk, controller)
  }

  async abort(reason?: any) {
    this.pair.source.controller.error(reason)
    return await this.subsink.abort?.(reason)
  }

  async close() {
    this.pair.source.controller.close()
    return await this.subsink.close?.()
  }

}

export class StreamPairSource<R, W> implements UnderlyingDefaultSource<R> {

  #controller?: ReadableStreamDefaultController<R>

  constructor(
    readonly pair: StreamPair<R, W>,
    readonly subsource: UnderlyingSource<R>
  ) { }

  get controller() {
    return this.#controller!
  }

  async start(controller: ReadableStreamDefaultController<R>) {
    this.#controller = controller
    return await this.subsource.start?.(controller)
  }

  async pull(controller: ReadableStreamDefaultController<R>) {
    return await this.subsource.pull?.(controller)
  }

  async cancel(reason?: any) {
    this.pair.sink.controller.error(reason)
    return await this.subsource.cancel?.(reason)
  }

}