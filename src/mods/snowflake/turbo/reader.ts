import { BinaryReadError, Opaque } from "@hazae41/binary"
import { ControllerError, SuperTransformStream } from "@hazae41/cascade"
import { CloseEvents, ErrorEvents, SuperEventTarget } from "@hazae41/plume"
import { Ok, Result } from "@hazae41/result"
import { TurboFrame, TurboFrameError } from "./frame.js"
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

  #onRead(chunk: Opaque): Result<void, BinaryReadError | TurboFrameError | ControllerError> {
    return Result.unthrowSync(t => {
      const frame = chunk.tryReadInto(TurboFrame).throw(t)

      if (frame.padding)
        return Ok.void()

      return this.stream.tryEnqueue(frame.fragment)
    })
  }
}