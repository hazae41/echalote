import { SmuxSegment } from "mods/smux/segment.js";
import { KcpSegment } from "./segment.js";
import { KcpStream } from "./stream.js";

export class KcpWriter {

  readonly sink: KcpWriterSink
  readonly source: KcpWriterSource

  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<Uint8Array>

  constructor(
    readonly stream: KcpStream
  ) {
    this.sink = new KcpWriterSink(this)
    this.source = new KcpWriterSource(this)

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

export class KcpWriterSink implements UnderlyingSink<Uint8Array>{

  #controller?: WritableStreamDefaultController

  constructor(
    readonly writer: KcpWriter
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
    const conversation = this.stream.conversation
    const command = KcpSegment.commands.push
    const send_counter = this.stream.send_counter++
    const recv_counter = this.stream.recv_counter
    const segment = new KcpSegment(conversation, command, 0, 65536, Date.now() / 1000, send_counter, recv_counter, chunk)
    console.log("kcp->", segment)
    const smux = new SmuxSegment(2, SmuxSegment.commands.psh, 1, segment.export())
    console.log("smux->", smux)
    this.source.controller.enqueue(smux.export())
  }

  async abort(reason?: any) {
    this.source.controller.error(reason)
  }

  async close() {
    this.source.controller.close()
  }

}

export class KcpWriterSource implements UnderlyingSource<Uint8Array> {

  #controller?: ReadableStreamController<Uint8Array>

  constructor(
    readonly writer: KcpWriter
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
  }

  async cancel(reason?: any) {
    this.sink.controller.error(reason)
  }

}