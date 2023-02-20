import { Cursor, Empty, Opaque, Writable } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { Future } from "libs/futures/future.js";
import { StreamPair } from "libs/streams/pair.js";
import { SmuxSegment, SmuxUpdate } from "mods/snowflake/smux/segment.js";
import { SmuxStream } from "./stream.js";

export class SmuxReader extends AsyncEventTarget {
  readonly #class = SmuxReader

  readonly pair: StreamPair<Uint8Array, Uint8Array>

  #consumed = 0
  #increment = 0

  readonly #buffer = Cursor.allocUnsafe(65535)

  constructor(
    readonly stream: SmuxStream
  ) {
    super()

    this.pair = new StreamPair({}, {
      write: this.#onRead.bind(this)
    })
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

  async #onRead(chunk: Uint8Array) {
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
    if (segment.version !== 2)
      throw new Error(`Invalid SMUX version`)

    // console.log("<-", segment)

    if (segment.command === SmuxSegment.commands.psh)
      return await this.#onPshSegment(segment)
    if (segment.command === SmuxSegment.commands.nop)
      return await this.#onNopSegment(segment)
    if (segment.command === SmuxSegment.commands.upd)
      return await this.#onUpdSegment(segment)
    if (segment.command === SmuxSegment.commands.fin)
      return await this.#onFinSegment(segment)
    console.warn(segment)
  }

  async #onPshSegment(segment: SmuxSegment<Opaque>) {
    this.#consumed += segment.fragment.bytes.length
    this.#increment += segment.fragment.bytes.length

    this.pair.enqueue(segment.fragment.bytes)

    if (this.#increment >= (1048576 / 2)) {
      const update = new SmuxUpdate(this.#consumed, 1048576)
      const segment = new SmuxSegment(2, SmuxSegment.commands.upd, 1, update)
      this.stream.writer.pair.enqueue(Writable.toBytes(segment))
      this.#increment = 0
    }
  }

  async #onNopSegment(ping: SmuxSegment<Opaque>) {
    const pong = new SmuxSegment(2, SmuxSegment.commands.nop, ping.stream, new Empty())
    this.stream.writer.pair.enqueue(Writable.toBytes(pong))
  }

  async #onUpdSegment(segment: SmuxSegment<Opaque>) {
    const update = segment.fragment.into(SmuxUpdate)
  }

  async #onFinSegment(segment: SmuxSegment<Opaque>) {
    throw new Error(`Closed`)
  }

}