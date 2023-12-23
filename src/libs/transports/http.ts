import { Opaque, Writable } from "@hazae41/binary"
import { SuperReadableStream, SuperWritableStream } from "@hazae41/cascade"
import { Cursor } from "@hazae41/cursor"
import { CloseEvents, ErrorEvents, SuperEventTarget } from "@hazae41/plume"
import { Resizer } from "libs/resizer/resizer.js"

export class BatchedFetchStream {

  readonly outer: ReadableWritablePair<Opaque, Writable>

  readonly #buffer = new Resizer()

  timeout?: NodeJS.Timeout
  interval?: NodeJS.Timeout

  readonly #input: SuperReadableStream<Opaque>
  readonly #output: SuperWritableStream<Writable>

  readonly events = {
    input: new SuperEventTarget<CloseEvents & ErrorEvents>(),
    output: new SuperEventTarget<CloseEvents & ErrorEvents>()
  } as const

  constructor(
    readonly request: RequestInfo
  ) {
    this.#input = new SuperReadableStream<Opaque>({})

    this.#output = new SuperWritableStream<Writable>({
      write: this.#onOutputWrite.bind(this)
    })

    const preInputer = this.#input.start()
    const postOutputer = this.#output.start()

    const postInputer = new TransformStream<Opaque, Opaque>({})
    const preOutputer = new TransformStream<Writable, Writable>({})

    /**
     * Outer protocol (TLS? HTTP?)
     */
    this.outer = {
      readable: postInputer.readable,
      writable: preOutputer.writable
    }

    preInputer
      .pipeTo(postInputer.writable)
      .then(() => this.#onInputClose())
      .catch(e => this.#onInputError(e))
      .catch(console.error)

    preOutputer.readable
      .pipeTo(postOutputer)
      .then(() => this.#onOutputClose())
      .catch(e => this.#onOutputError(e))
      .catch(console.error)

    this.loop()
  }

  async loop() {
    while (true) {
      try {
        const body = this.#buffer.inner.before
        this.#buffer.inner.offset = 0

        const res = await fetch(this.request, { method: "POST", body })
        const data = new Uint8Array(await res.arrayBuffer())

        const chunker = new Cursor(data)

        for (const chunk of chunker.splitOrThrow(16384))
          this.#input.enqueue(new Opaque(chunk))

        continue
      } catch (e: unknown) {
        clearInterval(this.interval)
        this.#output.error(e)
        break
      }
    }
  }

  async #onInputClose() {
    this.#input.closed = {}

    await this.events.input.emit("close", [undefined])
  }

  async #onOutputClose() {
    this.#output.closed = {}

    await this.events.output.emit("close", [undefined])
  }

  async #onInputError(reason?: unknown) {
    this.#input.closed = { reason }
    this.#output.error(reason)

    await this.events.input.emit("error", [reason])
  }

  async #onOutputError(reason?: unknown) {
    this.#output.closed = { reason }
    this.#input.error(reason)

    await this.events.output.emit("error", [reason])
  }

  async #onOutputWrite(writable: Writable) {
    this.#buffer.writeFromOrThrow(writable)
  }

}