import { Opaque, Writable } from "@hazae41/binary"
import { SuperReadableStream, SuperWritableStream } from "@hazae41/cascade"
import { Cursor } from "@hazae41/cursor"
import { Mutex } from "@hazae41/mutex"
import { CloseEvents, ErrorEvents, SuperEventTarget } from "@hazae41/plume"

export interface BatchedFetchStreamParams {
  /**
   * Minimum delay of interaction
   * 
   * Delay between a write and a fetch (in order to wait for more packets and batch them)
   */
  readonly lowDelay?: number

  /**
   * Maximum delay of interaction
   * 
   * Delay between each fetch when the batch is empty
   */
  readonly highDelay?: number
}

export class BatchedFetchStream {

  readonly outer: ReadableWritablePair<Opaque, Writable>

  readonly buffer = new Cursor(new Uint8Array(2 ** 16))

  timeout?: NodeJS.Timeout
  interval?: NodeJS.Timeout

  readonly #input: SuperReadableStream<Opaque>
  readonly #output: SuperWritableStream<Writable>

  readonly #mutex = new Mutex(undefined)

  readonly events = {
    input: new SuperEventTarget<CloseEvents & ErrorEvents>(),
    output: new SuperEventTarget<CloseEvents & ErrorEvents>()
  } as const

  constructor(
    readonly request: RequestInfo,
    readonly params: BatchedFetchStreamParams = {}
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

  async #onOutputWrite(chunk: Writable) {
    const { lowDelay = 10, highDelay = 100 } = this.params

    clearTimeout(this.timeout)
    clearInterval(this.interval)

    this.buffer.writeOrThrow(Writable.writeToBytesOrThrow(chunk))

    this.timeout = setTimeout(async () => {
      try {
        const body = this.buffer.before

        const res = await fetch(this.request, { method: "POST", body })
        const data = new Uint8Array(await res.arrayBuffer())

        this.buffer.offset = 0

        const chunker = new Cursor(data)

        for (const chunk of chunker.splitOrThrow(128))
          this.#input.enqueue(new Opaque(chunk))

        this.interval = setInterval(async () => {
          try {
            const res = await fetch(this.request, { method: "POST" })
            const data = new Uint8Array(await res.arrayBuffer())

            const chunker = new Cursor(data)

            for (const chunk of chunker.splitOrThrow(128))
              this.#input.enqueue(new Opaque(chunk))

            return
          } catch (e: unknown) {
            clearInterval(this.interval)
            this.#output.error(e)
          }
        }, highDelay)
      } catch (e: unknown) {
        clearInterval(this.interval)
        this.#output.error(e)
      }
    }, lowDelay)
  }

}