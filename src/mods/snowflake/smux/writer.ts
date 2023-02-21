import { Empty, Opaque, Writable } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { Future } from "libs/futures/future.js";
import { StreamPair } from "libs/streams/pair.js";
import { SmuxSegment, SmuxUpdate } from "mods/snowflake/smux/segment.js";
import { SecretSmuxStream } from "./stream.js";

export class SmuxWriter extends AsyncEventTarget<"close" | "error"> {

  readonly #secret: SecretSmuxWriter

  constructor(secret: SecretSmuxWriter) {
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

export class SecretSmuxWriter {

  readonly pair: StreamPair<Uint8Array, Uint8Array>

  readonly overt = new SmuxWriter(this)

  constructor(
    readonly stream: SecretSmuxStream
  ) {
    this.pair = new StreamPair({
      start: this.#onStart.bind(this),
    }, {
      write: this.#onWrite.bind(this)
    })
  }

  async #onStart(controller: ReadableStreamDefaultController<Uint8Array>) {
    await this.#sendSYN(controller)
    await this.#sendUPD(controller)
  }

  async #sendSYN(controller: ReadableStreamDefaultController<Uint8Array>) {
    const segment = new SmuxSegment(2, SmuxSegment.commands.syn, 1, new Empty())
    controller.enqueue(Writable.toBytes(segment))
  }

  async #sendUPD(controller: ReadableStreamDefaultController<Uint8Array>) {
    const update = new SmuxUpdate(0, 1048576)
    const segment = new SmuxSegment(2, SmuxSegment.commands.upd, 1, update)
    controller.enqueue(Writable.toBytes(segment))
  }

  async #onWrite(chunk: Uint8Array) {
    const inflight = this.stream.selfWrite - this.stream.peerConsumed

    if (inflight >= this.stream.peerWindow)
      throw new Error(`Peer window reached`)

    const segment = new SmuxSegment(2, SmuxSegment.commands.psh, 1, new Opaque(chunk))
    this.pair.enqueue(Writable.toBytes(segment))

    this.stream.selfWrite += chunk.length
  }

}