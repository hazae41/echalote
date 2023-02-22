import { Future } from "libs/futures/future.js"

export class StreamPair<R, W>  {

  readonly sink: StreamPairSink<R, W>
  readonly source: StreamPairSource<R, W>

  constructor(
    subsource: UnderlyingDefaultSource<R>,
    subsink: UnderlyingSink<W>,
  ) {
    this.source = new StreamPairSource(this, subsource)
    this.sink = new StreamPairSink(this, subsink)
  }

  pipe() {
    const readable = new ReadableStream(this.source)
    const writable = new WritableStream(this.sink)

    return { readable, writable }
  }

  enqueue(chunk?: R) {
    this.source.controller.enqueue(chunk)
  }

  error(reason?: any) {
    this.sink.controller.error(reason)
    this.source.controller.error(reason)
  }

  terminate() {
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
    await this.pair.source.started
    this.#controller = controller
    await this.subsink.start?.(controller)
  }

  async write(chunk: W, controller: WritableStreamDefaultController) {
    await this.subsink.write?.(chunk, controller)
  }

  async abort(reason?: any) {
    await this.subsink.abort?.(reason)
    this.pair.source.controller.error(reason)
  }

  async close() {
    await this.subsink.close?.()
    this.pair.source.controller.close()
  }

}

export class StreamPairSource<R, W> implements UnderlyingDefaultSource<R> {

  #controller?: ReadableStreamDefaultController<R>

  #started = new Future<void, never>()

  constructor(
    readonly pair: StreamPair<R, W>,
    readonly subsource: UnderlyingDefaultSource<R>
  ) { }

  get controller() {
    return this.#controller!
  }

  get started() {
    return this.#started.promise
  }

  async start(controller: ReadableStreamDefaultController<R>) {
    this.#controller = controller
    await this.subsource.start?.(controller)
    this.#started.ok()
  }

  async pull(controller: ReadableStreamDefaultController<R>) {
    await this.subsource.pull?.(controller)
  }

  async cancel(reason?: any) {
    await this.subsource.cancel?.(reason)
    this.pair.sink.controller.error(reason)
  }

}