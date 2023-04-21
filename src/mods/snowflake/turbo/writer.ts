import { Opaque, Writable } from "@hazae41/binary";
import { SuperTransformStream } from "@hazae41/cascade";
import { AsyncEventTarget, CloseAndErrorEvents } from "@hazae41/plume";
import { TurboFrame } from "./frame.js";
import { SecretTurboDuplex } from "./stream.js";

export class SecretTurboWriter {

  readonly events = new AsyncEventTarget<CloseAndErrorEvents>()

  readonly stream: SuperTransformStream<Writable, Writable>

  constructor(
    readonly parent: SecretTurboDuplex
  ) {
    this.stream = new SuperTransformStream({
      start: this.#onStart.bind(this),
      transform: this.#onWrite.bind(this)
    })
  }

  async #onStart() {
    const token = this.parent.class.token
    this.stream.enqueue(new Opaque(token))

    const clientID = this.parent.clientID
    this.stream.enqueue(new Opaque(clientID))
  }

  async #onWrite(chunk: Writable) {
    const frame = new TurboFrame(false, chunk)
    this.stream.enqueue(frame.prepare())
  }

}

