import { Opaque } from "@hazae41/binary"
import { None } from "@hazae41/option"
import { TurboFrame } from "./frame.js"
import { SecretTurboDuplex } from "./stream.js"

export class SecretTurboReader {

  constructor(
    readonly parent: SecretTurboDuplex
  ) {
    this.parent.input.events.on("message", async chunk => {
      await this.#onMessage(chunk)
      return new None()
    })
  }

  async #onMessage(chunk: Opaque) {
    const frame = chunk.readIntoOrThrow(TurboFrame)

    if (frame.padding)
      return

    await this.parent.input.enqueue(frame.fragment)
  }

}