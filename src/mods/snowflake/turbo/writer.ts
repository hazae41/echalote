import { Writable } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { SuperTransformStream } from "libs/streams/transform.js";
import { TurboFrame } from "./frame.js";
import { SecretTurboStream } from "./stream.js";

export class SecretTurboWriter extends AsyncEventTarget<"close" | "error"> {

  readonly stream: SuperTransformStream<Writable, Uint8Array>

  constructor(
    readonly parent: SecretTurboStream
  ) {
    super()

    this.stream = new SuperTransformStream({
      start: this.#onStart.bind(this),
      transform: this.#onWrite.bind(this)
    })
  }

  async #onStart() {
    const token = this.parent.class.token
    this.stream.enqueue(token)

    const clientID = this.parent.clientID
    this.stream.enqueue(clientID)
  }

  async #onWrite(chunk: Writable) {
    const frame = new TurboFrame(false, chunk)
    this.stream.enqueue(Writable.toBytes(frame.prepare()))
  }

}

