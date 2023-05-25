import { BinaryReadError, Opaque } from "@hazae41/binary"
import { SuperTransformStream } from "@hazae41/cascade"
import { StreamEvents, SuperEventTarget } from "@hazae41/plume"
import { Ok, Result } from "@hazae41/result"
import { FragmentOverflowError, TurboFrame, UnexpectedContinuationError } from "./frame.js"
import { SecretTurboDuplex } from "./stream.js"

export class SecretTurboReader {

  readonly events = new SuperEventTarget<StreamEvents>()

  readonly stream: SuperTransformStream<Opaque, Opaque>

  constructor(
    readonly parent: SecretTurboDuplex
  ) {
    this.stream = new SuperTransformStream({
      transform: this.#onRead.bind(this)
    })
  }

  #onRead(chunk: Opaque): Result<void, BinaryReadError | FragmentOverflowError | UnexpectedContinuationError> {
    return Result.unthrowSync(t => {
      const frame = chunk.tryInto(TurboFrame).throw(t)

      if (frame.padding)
        return Ok.void()

      this.stream.enqueue(frame.fragment)
      return Ok.void()
    })
  }
}