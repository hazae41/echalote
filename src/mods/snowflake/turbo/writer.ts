import { Opaque, Writable } from "@hazae41/binary";
import { None } from "@hazae41/option";
import { TurboFrame } from "./frame.js";
import { SecretTurboDuplex } from "./stream.js";

export class SecretTurboWriter {

  constructor(
    readonly parent: SecretTurboDuplex
  ) {
    this.parent.output.events.on("open", async () => {
      await this.#onStart()
      return new None()
    })

    this.parent.output.events.on("message", async chunk => {
      await this.#onMessage(chunk)
      return new None()
    })
  }

  async #onStart() {
    const token = this.parent.class.token
    await this.parent.output.enqueue(new Opaque(token))

    const client = this.parent.client
    await this.parent.output.enqueue(new Opaque(client))
  }

  async #onMessage(fragment: Writable) {
    const frame = TurboFrame.createOrThrow({ padding: false, fragment })
    await this.parent.output.enqueue(frame)
  }

}

