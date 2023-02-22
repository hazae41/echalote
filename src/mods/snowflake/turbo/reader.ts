import { Opaque, Readable } from "@hazae41/binary"
import { AsyncEventTarget } from "libs/events/target.js"
import { Future } from "libs/futures/future.js"
import { StreamPair } from "libs/streams/pair.js"
import { TurboFrame } from "./frame.js"
import { SecretTurboStream } from "./stream.js"

export class TurboReader extends AsyncEventTarget<"close" | "error"> {

  readonly #secret: SecretTurboReader

  constructor(secret: SecretTurboReader) {
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

export class SecretTurboReader {

  readonly overt = new TurboReader(this)

  readonly pair: StreamPair<Opaque, Uint8Array>

  constructor(
    readonly stream: SecretTurboStream
  ) {
    this.pair = new StreamPair({}, {
      write: this.#onRead.bind(this)
    })
  }

  async #onRead(chunk: Uint8Array) {
    const frame = Readable.fromBytes(TurboFrame, chunk)

    if (frame.padding) return

    this.pair.enqueue(frame.fragment)
  }
}