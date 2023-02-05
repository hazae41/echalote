import { TurboFrame } from "./frame.js";
import { TurboStream } from "./stream.js";

export class TurboWriter {

  readonly sink: TurboWriterSink
  readonly source: TurboWriterSource

  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<Uint8Array>

  constructor(
    readonly stream: TurboStream
  ) {
    this.sink = new TurboWriterSink(this)
    this.source = new TurboWriterSource(this)

    this.writable = new WritableStream(this.sink)
    this.readable = new ReadableStream(this.source)
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

export class TurboWriterSink implements UnderlyingSink<Uint8Array> {

  #controller?: WritableStreamDefaultController

  constructor(
    readonly writer: TurboWriter
  ) { }

  get controller() {
    return this.#controller!
  }

  get other() {
    return this.writer.source.controller
  }

  async start(controller: WritableStreamDefaultController) {
    this.#controller = controller
  }

  async write(chunk: Uint8Array) {
    const frame = new TurboFrame(false, chunk)
    this.other.enqueue(frame.export())
  }

  async abort(reason?: any) {
    this.other.error(reason)
  }

  async close() {
    this.other.close()
  }
}

export class TurboWriterSource implements UnderlyingSource<Uint8Array> {

  #controller?: ReadableStreamController<Uint8Array>

  constructor(
    readonly writer: TurboWriter
  ) { }

  get controller() {
    return this.#controller!
  }

  get other() {
    return this.writer.source.controller
  }

  async start(controller: ReadableStreamController<Uint8Array>) {
    this.#controller = controller

    const token = this.writer.stream.class.TOKEN
    this.controller.enqueue(token)

    const clientID = this.writer.stream.clientID
    this.controller.enqueue(clientID)
  }

  async cancel(reason?: any) {
    this.other.error(reason)
  }
}