import { Opaque, Readable } from "@hazae41/binary"
import { AsyncEventTarget } from "libs/events/target.js"
import { SuperTransformStream } from "libs/streams/transform.js"
import { TurboFrame } from "./frame.js"
import { SecretTurboStream } from "./stream.js"

export class SecretTurboReader extends AsyncEventTarget<"close" | "error"> {

  readonly stream: SuperTransformStream<Uint8Array, Opaque>

  constructor(
    readonly parent: SecretTurboStream
  ) {
    super()

    this.stream = new SuperTransformStream({
      transform: this.#onRead.bind(this)
    })
  }

  async #onRead(chunk: Uint8Array) {
    const frame = Readable.fromBytes(TurboFrame, chunk)

    if (frame.padding) return

    this.stream.enqueue(frame.fragment)
  }
}