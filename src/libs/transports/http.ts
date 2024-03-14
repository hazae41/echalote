import { Opaque, Writable } from "@hazae41/binary"
import { FullDuplex } from "@hazae41/cascade"
import { Cursor } from "@hazae41/cursor"
import { Resizer } from "libs/resizer/resizer.js"

export class BatchedFetchStream {

  readonly duplex: FullDuplex<Opaque, Writable>

  readonly #buffer = new Resizer()

  constructor(
    readonly request: RequestInfo
  ) {
    this.duplex = new FullDuplex({
      output: {
        write: c => this.#buffer.writeFromOrThrow(c),
      }
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
          this.duplex.input.enqueue(new Opaque(chunk))

        continue
      } catch (e: unknown) {
        this.duplex.error(e)
        break
      }
    }
  }

}