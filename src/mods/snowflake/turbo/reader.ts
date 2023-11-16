import { Opaque } from "@hazae41/binary"
import { SuperTransformStream } from "@hazae41/cascade"
import { CloseEvents, ErrorEvents, SuperEventTarget } from "@hazae41/plume"
import { Ok } from "@hazae41/result"
import { TurboFrame } from "./frame.js"
import { SecretTurboDuplex } from "./stream.js"

export class SecretTurboReader {

  readonly events = new SuperEventTarget<CloseEvents & ErrorEvents>()

  readonly stream: SuperTransformStream<Opaque, Opaque>

  constructor(
    readonly parent: SecretTurboDuplex
  ) {
    this.stream = new SuperTransformStream({
      transform: this.#onRead.bind(this)
    })
  }

  #onRead(chunk: Opaque) {
    const frame = chunk.readIntoOrThrow(TurboFrame)

    if (frame.padding)
      return Ok.void()

    this.stream.enqueue(frame.fragment)
    return Ok.void()
  }

}