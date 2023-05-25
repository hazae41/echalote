import { Opaque, Writable } from "@hazae41/binary";
import { SuperTransformStream } from "@hazae41/cascade";
import { StreamEvents, SuperEventTarget } from "@hazae41/plume";
import { Ok } from "@hazae41/result";
import { TurboFrame } from "./frame.js";
import { SecretTurboDuplex } from "./stream.js";

export class SecretTurboWriter {

  readonly events = new SuperEventTarget<StreamEvents>()

  readonly stream: SuperTransformStream<Writable, Writable>

  constructor(
    readonly parent: SecretTurboDuplex
  ) {
    this.stream = new SuperTransformStream({
      start: this.#onStart.bind(this),
      transform: this.#onWrite.bind(this)
    })
  }

  #onStart() {
    const token = this.parent.class.token
    this.stream.enqueue(new Opaque(token))

    const clientID = this.parent.clientID
    this.stream.enqueue(new Opaque(clientID))

    return Ok.void()
  }

  #onWrite(fragment: Writable) {
    return TurboFrame
      .tryNew({ padding: false, fragment })
      .mapSync(frame => this.stream.enqueue(frame))
  }

}

