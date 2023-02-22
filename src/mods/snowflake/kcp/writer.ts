import { Writable } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { Future } from "libs/futures/future.js";
import { StreamPair } from "libs/streams/pair.js";
import { KcpSegment } from "./segment.js";
import { SecretKcpStream } from "./stream.js";

export class KcpWriter extends AsyncEventTarget<"close" | "error"> {

  readonly #secret: SecretKcpWriter

  constructor(secret: SecretKcpWriter) {
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

export class SecretKcpWriter {

  readonly overt = new KcpWriter(this)

  readonly pair: StreamPair<Writable, Writable>

  constructor(
    readonly stream: SecretKcpStream,
  ) {
    this.pair = new StreamPair({}, {
      write: this.#onWrite.bind(this)
    })
  }

  async #onWrite(chunk: Writable) {
    const conversation = this.stream.overt.conversation
    const command = KcpSegment.commands.push
    const send_counter = this.stream.send_counter++
    const recv_counter = this.stream.recv_counter
    const segment = new KcpSegment(conversation, command, 0, 65535, Date.now() / 1000, send_counter, recv_counter, chunk)
    this.pair.enqueue(segment)
  }

}