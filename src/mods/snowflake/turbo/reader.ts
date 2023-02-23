import { Opaque, Readable } from "@hazae41/binary"
import { AsyncEventTarget } from "libs/events/target.js"
import { StreamPair } from "libs/streams/pair.js"
import { TurboFrame } from "./frame.js"
import { SecretTurboStream } from "./stream.js"

export class SecretTurboReader extends AsyncEventTarget<"close" | "error"> {

  readonly pair: StreamPair<Opaque, Uint8Array>

  constructor(
    readonly stream: SecretTurboStream
  ) {
    super()

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