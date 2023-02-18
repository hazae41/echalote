import { Cursor, Opaque } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { Future } from "libs/futures/future.js";
import { SmuxSegment } from "mods/smux/segment.js";
import { SmuxStream } from "./stream.js";

export class SmuxReader extends AsyncEventTarget {
  readonly #class = SmuxReader

  readonly sink: SmuxReaderSink
  readonly source: SmuxReaderSource

  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<Uint8Array>

  readonly #buffer = Cursor.allocUnsafe(65535)

  constructor(
    readonly stream: SmuxStream
  ) {
    super()

    this.sink = new SmuxReaderSink(this)
    this.source = new SmuxReaderSource(this)

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

  async onRead(chunk: Uint8Array) {
    // console.debug("<-", chunk)

    if (this.#buffer.offset)
      await this.#onReadBuffered(chunk)
    else
      await this.#onReadDirect(chunk)
  }

  async #onReadBuffered(chunk: Uint8Array) {
    this.#buffer.write(chunk)
    const full = this.#buffer.before

    this.#buffer.offset = 0
    await this.#onReadDirect(full)
  }

  async #onReadDirect(chunk: Uint8Array) {
    const cursor = new Cursor(chunk)

    while (cursor.remaining) {
      const segment = SmuxSegment.tryRead(cursor)

      if (!segment) {
        this.#buffer.write(cursor.after)
        break
      }

      await this.#onSegment(segment)
    }
  }

  async #onSegment(segment: SmuxSegment<Opaque>) {
    if (segment.command === SmuxSegment.commands.psh)
      return this.source.controller.enqueue(segment.fragment.bytes)
  }

}

export class SmuxReaderSink implements UnderlyingSink<Uint8Array>{

  #controller?: WritableStreamDefaultController

  constructor(
    readonly reader: SmuxReader
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
    return await this.reader.onRead(chunk)
  }

  async abort(reason?: any) {
    this.source.controller.error(reason)
  }

  async close() {
    this.source.controller.close()
  }

}

export class SmuxReaderSource implements UnderlyingSource<Uint8Array> {

  #controller?: ReadableStreamController<Uint8Array>

  constructor(
    readonly reader: SmuxReader
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