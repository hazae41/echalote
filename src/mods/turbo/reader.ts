import { Binary } from "@hazae41/binary"
import { TurboFrame } from "./frame.js"
import { TurboStream } from "./stream.js"

export class TurboReader {

  readonly sink: TurboReaderSink
  readonly source: TurboReaderSource

  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<Uint8Array>

  constructor(
    readonly stream: TurboStream
  ) {
    this.sink = new TurboReaderSink(this)
    this.source = new TurboReaderSource(this)

    this.writable = new WritableStream<Uint8Array>(this.sink)
    this.readable = new ReadableStream<Uint8Array>(this.source)
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

export class TurboReaderSink implements UnderlyingSink<Uint8Array> {

  #controller?: WritableStreamDefaultController

  constructor(
    readonly reader: TurboReader
  ) { }

  get controller() {
    return this.#controller!
  }

  get other() {
    return this.reader.source.controller
  }

  async start(controller: WritableStreamDefaultController) {
    this.#controller = controller
  }

  async write(chunk: Uint8Array) {
    const frame = TurboFrame.read(new Binary(chunk))
    this.reader.source.controller.enqueue(frame.data)
  }

  async abort(reason?: any) {
    this.other.error(reason)
  }

  async close() {
    this.other.close()
  }
}

export class TurboReaderSource implements UnderlyingSource<Uint8Array> {

  #controller?: ReadableStreamController<Uint8Array>

  constructor(
    readonly reader: TurboReader
  ) { }

  get controller() {
    return this.#controller!
  }

  get other() {
    return this.reader.sink.controller
  }

  async start(controller: ReadableStreamController<Uint8Array>) {
    this.#controller = controller
  }

  async cancel(reason?: any) {
    this.other.error(reason)
  }
}