import { Writable } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { Future } from "libs/futures/future.js";
import { StreamPair } from "libs/streams/pair.js";
import { TurboFrame } from "./frame.js";
import { SecretTurboStream } from "./stream.js";

export class SmuxWriter extends AsyncEventTarget<"close" | "error"> {

  readonly #secret: SecretTurboWriter

  constructor(secret: SecretTurboWriter) {
    super()

    this.#secret = secret
  }

  get stream() {
    return this.#secret.stream.overt
  }

  async wait<E extends Event>(event: never) {
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

export class SecretTurboWriter {

  readonly pair: StreamPair<Uint8Array, Writable>

  readonly overt = new SmuxWriter(this)

  constructor(
    readonly stream: SecretTurboStream
  ) {
    this.pair = new StreamPair({
      start: this.#onStart.bind(this),
    }, {
      write: this.#onWrite.bind(this)
    })
  }

  async #onStart(controller: ReadableStreamDefaultController<Uint8Array>) {
    const token = this.stream.class.token
    controller.enqueue(token)

    const clientID = this.stream.clientID
    controller.enqueue(clientID)
  }

  async #onWrite(chunk: Writable) {
    const frame = new TurboFrame(false, chunk)
    this.pair.enqueue(Writable.toBytes(frame.prepare()))
  }

}

