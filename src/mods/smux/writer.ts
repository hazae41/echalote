import { SmuxSegment } from "mods/smux/segment.js";
import { SmuxStream } from "./stream.js";

export class SmuxWriter {

  readonly sink: SmuxWriterSink
  readonly source: SmuxWriterSource

  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<Uint8Array>

  constructor(
    readonly stream: SmuxStream
  ) {
    this.sink = new SmuxWriterSink(this)
    this.source = new SmuxWriterSource(this)

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

export class SmuxWriterSink implements UnderlyingSink<Uint8Array>{

  #controller?: WritableStreamDefaultController

  constructor(
    readonly writer: SmuxWriter
  ) { }

  get controller() {
    return this.#controller!
  }

  get source() {
    return this.writer.source
  }

  get stream() {
    return this.writer.stream
  }

  async start(controller: WritableStreamDefaultController) {
    this.#controller = controller
  }

  async write(chunk: Uint8Array) {
    const segment = new SmuxSegment(2, SmuxSegment.commands.psh, 1, chunk)
    console.log("->", segment)
    this.source.controller.enqueue(segment.export())
  }

  async abort(reason?: any) {
    this.source.controller.error(reason)
  }

  async close() {
    this.source.controller.close()
  }

}

export class SmuxWriterSource implements UnderlyingSource<Uint8Array> {

  #controller?: ReadableStreamController<Uint8Array>

  constructor(
    readonly writer: SmuxWriter
  ) { }

  get controller() {
    return this.#controller!
  }

  get sink() {
    return this.writer.sink
  }

  get stream() {
    return this.writer.stream
  }

  async start(controller: ReadableStreamController<Uint8Array>) {
    this.#controller = controller

    const segment = new SmuxSegment(2, SmuxSegment.commands.syn, 1, new Uint8Array())
    console.log("->", segment)

    this.controller.enqueue(segment.export())
  }

  async cancel(reason?: any) {
    this.sink.controller.error(reason)
  }

}