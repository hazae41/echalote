import { Binary } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { Future } from "libs/futures/future.js";
import { KcpSegment } from "./segment.js";
import { KcpStream } from "./stream.js";

export class KcpReader extends AsyncEventTarget {

  readonly sink: KcpReaderSink
  readonly source: KcpReaderSource

  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<Uint8Array>

  constructor(
    readonly stream: KcpStream
  ) {
    super()

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

  async wait<T extends Event>(event: string) {
    const future = new Future<Event, Error>()

    const onClose = (event: Event) => {
      const closeEvent = event as CloseEvent
      const error = new Error(`Closed`, { cause: closeEvent })
      future.err(error)
    }

    const onError = (event: Event) => {
      const errorEvent = event as ErrorEvent
      const error = new Error(`Errored`, { cause: errorEvent })
      future.err(error)
    }

    try {
      this.addEventListener("close", onClose, { passive: true })
      this.addEventListener("error", onError, { passive: true })
      this.addEventListener(event, future.ok, { passive: true })

      return await future.promise as T
    } finally {
      this.removeEventListener("close", onClose)
      this.removeEventListener("error", onError)
      this.removeEventListener(event, future.ok)
    }
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
    const segment = KcpSegment.read(new Binary(chunk))
    this.stream.recv_counter++
    console.log("<-", segment)

    if (segment.command === KcpSegment.commands.push)
      return await this.onPush(segment)
    if (segment.command === KcpSegment.commands.ack)
      return await this.onAck(segment)
    if (segment.command === KcpSegment.commands.wask)
      return await this.onWask(segment)
  }

  async abort(reason?: any) {
    this.source.controller.error(reason)
  }

  async close() {
    this.source.controller.close()
  }

  private async onPush(segment: KcpSegment) {
    this.source.controller.enqueue(segment.data)
  }

  private async onAck(segment: KcpSegment) {
    this.reader.dispatchEvent(new MessageEvent("ack", { data: segment }))
  }

  private async onWask(_: KcpSegment) {
    const conversation = this.stream.conversation
    const command = KcpSegment.commands.wins
    const send_counter = this.stream.send_counter++
    const recv_counter = this.stream.recv_counter
    const segment = new KcpSegment(conversation, command, 0, 65536, Date.now() / 1000, send_counter, recv_counter, new Uint8Array())
    this.stream.writer.source.controller.enqueue(segment.export())
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