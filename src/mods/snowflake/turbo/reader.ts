import { Opaque } from "@hazae41/binary"
import { AsyncEventTarget } from "libs/events/target.js"
import { SuperTransformStream } from "libs/streams/transform.js"
import { TurboFrame } from "./frame.js"
import { SecretTurboStream } from "./stream.js"

export class SecretTurboReader extends AsyncEventTarget<{
  close: CloseEvent,
  error: ErrorEvent
}> {

  readonly stream: SuperTransformStream<Opaque, Opaque>

  constructor(
    readonly parent: SecretTurboStream
  ) {
    super()

    this.stream = new SuperTransformStream({
      transform: this.#onRead.bind(this)
    })
  }

  async #onRead(chunk: Opaque) {
    const frame = chunk.into(TurboFrame)

    if (frame.padding) return

    this.stream.enqueue(frame.fragment)
  }
}