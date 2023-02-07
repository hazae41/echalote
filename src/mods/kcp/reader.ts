import { Binary } from "@hazae41/binary";
import { SmuxSegment } from "mods/smux/segment.js";
import { KcpSegment } from "./segment.js";
import { KcpStream } from "./stream.js";

export class KcpReader {

  readonly sink: KcpReaderSink
  readonly source: KcpReaderSource

  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<Uint8Array>

  constructor(
    readonly stream: KcpStream
  ) {
    this.sink = new KcpReaderSink(this)
    this.source = new KcpReaderSource(this)

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

export class KcpReaderSink implements UnderlyingSink<Uint8Array>{

  #controller?: WritableStreamDefaultController

  constructor(
    readonly reader: KcpReader
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
    const kcp = KcpSegment.read(new Binary(chunk))
    this.stream.recv_counter++
    console.log("kcp<-", kcp)

    const smux = SmuxSegment.read(new Binary(kcp.data))
    console.log("smux<-", smux)

    this.source.controller.enqueue(smux.data)
  }

  async abort(reason?: any) {
    this.source.controller.error(reason)
  }

  async close() {
    this.source.controller.close()
  }

}

export class KcpReaderSource implements UnderlyingSource<Uint8Array> {

  #controller?: ReadableStreamController<Uint8Array>

  constructor(
    readonly reader: KcpReader
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