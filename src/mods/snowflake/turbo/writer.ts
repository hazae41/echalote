import { Opaque, Writable } from "@hazae41/binary";
import { SuperTransformStream } from "@hazae41/cascade";
import { CloseEvents, ErrorEvents, SuperEventTarget } from "@hazae41/plume";
import { TurboFrame } from "./frame.js";
import { SecretTurboDuplex } from "./stream.js";

export class SecretTurboWriter {

  readonly events = new SuperEventTarget<CloseEvents & ErrorEvents>()

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
  }

  #onWrite(fragment: Writable) {
    this.stream.enqueue(TurboFrame.createOrThrow({ padding: false, fragment }))
  }

}

