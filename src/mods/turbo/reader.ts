import { Cursor } from "@hazae41/binary"
import { AsyncEventTarget } from "libs/events/target.js"
import { TurboFrame } from "./frame.js"
import { TurboStream } from "./stream.js"

export class TurboReader extends AsyncEventTarget {

  readonly sink: TurboReaderSink
  readonly source: TurboReaderSource

  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<Uint8Array>

  constructor(
    readonly stream: TurboStream
  ) {
    super()

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

  get source() {
    return this.reader.source
  }

  get stream() {
    return this.reader.stream
  }

  async start(controller: WritableStreamDefaultController) {
    this.#controller = controller
  }

  async write(chunk: Uint8Array) {
    const frame = TurboFrame.read(new Cursor(chunk))
    console.log("<-", frame)

    if (frame.padding) return

    this.source.controller.enqueue(frame.data)
  }

  async abort(reason?: any) {
    this.source.controller.error(reason)
  }

  async close() {
    this.source.controller.close()
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

  get sink() {
    return this.reader.sink
  }

  get stream() {
    return this.reader.stream
  }

  async start(controller: ReadableStreamController<Uint8Array>) {
    this.#controller = controller
  }

  async cancel(reason?: any) {
    this.sink.controller.error(reason)
  }
}