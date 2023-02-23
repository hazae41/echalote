import { Writable } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { StreamPair } from "libs/streams/pair.js";
import { TurboFrame } from "./frame.js";
import { SecretTurboStream } from "./stream.js";

export class SecretTurboWriter extends AsyncEventTarget<"close" | "error"> {

  readonly pair: StreamPair<Uint8Array, Writable>

  constructor(
    readonly stream: SecretTurboStream
  ) {
    super()

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

