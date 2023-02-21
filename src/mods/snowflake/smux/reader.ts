import { Cursor, Empty, Opaque, Writable } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { Future } from "libs/futures/future.js";
import { StreamPair } from "libs/streams/pair.js";
import { SmuxSegment, SmuxUpdate } from "mods/snowflake/smux/segment.js";
import { SecretSmuxStream } from "./stream.js";

export class SmuxReader extends AsyncEventTarget<"close" | "error"> {

  readonly #secret: SecretSmuxReader

  constructor(secret: SecretSmuxReader) {
    super()

    this.#secret = secret
  }

  get stream() {
    return this.#secret.stream.overt
  }

  async wait<E extends Event>(event: "close" | "error") {
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

      return await future.promise as E
    } finally {
      this.removeEventListener("close", onClose)
      this.removeEventListener("error", onError)
      this.removeEventListener(event, future.ok)
    }
  }
}

export class SecretSmuxReader {

  readonly overt = new SmuxReader(this)

  readonly pair: StreamPair<Uint8Array, Uint8Array>

  readonly #buffer = Cursor.allocUnsafe(65535)

  constructor(
    readonly stream: SecretSmuxStream
  ) {
    this.pair = new StreamPair({}, {
      write: this.#onRead.bind(this)
    })
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
    this.stream.selfRead += segment.fragment.bytes.length
    this.stream.selfIncrement += segment.fragment.bytes.length

    this.pair.enqueue(segment.fragment.bytes)

    if (this.stream.selfIncrement >= (this.stream.selfWindow / 2)) {
      const update = new SmuxUpdate(this.stream.selfRead, this.stream.selfWindow)
      const segment = new SmuxSegment(2, SmuxSegment.commands.upd, 1, update)
      this.stream.writer.pair.enqueue(Writable.toBytes(segment))
      this.stream.selfIncrement = 0
    }
  }

  async #onNopSegment(ping: SmuxSegment<Opaque>) {
    const pong = new SmuxSegment(2, SmuxSegment.commands.nop, ping.stream, new Empty())
    this.stream.writer.pair.enqueue(Writable.toBytes(pong))
  }

  async #onUpdSegment(segment: SmuxSegment<Opaque>) {
    const update = segment.fragment.into(SmuxUpdate)
    this.stream.peerConsumed = update.consumed
    this.stream.peerWindow = update.window
  }

  async #onFinSegment(segment: SmuxSegment<Opaque>) {
    throw new Error(`Closed`)
  }

}