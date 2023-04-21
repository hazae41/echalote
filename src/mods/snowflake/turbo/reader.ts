import { Opaque } from "@hazae41/binary"
import { SuperTransformStream } from "@hazae41/cascade"
import { AsyncEventTarget, CloseAndErrorEvents } from "@hazae41/plume"
import { TurboFrame } from "./frame.js"
import { SecretTurboDuplex } from "./stream.js"

export class SecretTurboReader {

  readonly events = new AsyncEventTarget<CloseAndErrorEvents>()

  readonly stream: SuperTransformStream<Opaque, Opaque>

  constructor(
    readonly parent: SecretTurboDuplex
  ) {
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