import { Opaque, Writable } from "@hazae41/binary"
import { FullDuplex } from "@hazae41/cascade"
import { Cursor } from "@hazae41/cursor"
import { None } from "@hazae41/option"
import { Resizer } from "libs/resizer/resizer.js"

export class BatchedFetchStream {

  readonly duplex = new FullDuplex<Opaque, Writable>()

  readonly #buffer = new Resizer()

  constructor(
    readonly request: RequestInfo
  ) {
    this.duplex.output.events.on("message", async chunk => {
      this.#buffer.writeFromOrThrow(chunk)
      return new None()
    })

    this.loop()
  }

  async loop() {
    while (!this.duplex.closed) {
      try {
        const body = this.#buffer.inner.before
        this.#buffer.inner.offset = 0

        const res = await fetch(this.request, { method: "POST", body })
        const data = new Uint8Array(await res.arrayBuffer())

        const chunker = new Cursor(data)

        for (const chunk of chunker.splitOrThrow(16384))
          await this.duplex.input.enqueue(new Opaque(chunk))

        continue
      } catch (e: unknown) {
        this.duplex.error(e)
        break
      }
    }
  }

}