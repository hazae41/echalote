import { Opaque, Writable } from "@hazae41/binary"
import { Bytes } from "@hazae41/bytes"
import { SecretTurboReader } from "./reader.js"
import { SecretTurboWriter } from "./writer.js"

export interface TurboStreamParams {
  clientID?: Uint8Array
}

export class SecretTurboStream {
  readonly #class = SecretTurboStream

  static readonly token = new Uint8Array([0x12, 0x93, 0x60, 0x5d, 0x27, 0x81, 0x75, 0xf5])

  readonly reader: SecretTurboReader
  readonly writer: SecretTurboWriter

  readonly clientID: Uint8Array

  constructor(
    readonly overt: TurboStream
  ) {
    const { clientID } = overt.params

    this.clientID = clientID ?? Bytes.random(8)

    this.reader = new SecretTurboReader(this)
    this.writer = new SecretTurboWriter(this)
  }

  get class() {
    return this.#class
  }

}

export class TurboStream {
  readonly #class = TurboStream

  readonly #secret: SecretTurboStream

  readonly readable: ReadableStream<Opaque>
  readonly writable: WritableStream<Writable>

  constructor(
    readonly stream: ReadableWritablePair<Uint8Array, Uint8Array>,
    readonly params: TurboStreamParams = {}
  ) {
    this.#secret = new SecretTurboStream(this)

    const readers = this.#secret.reader.pair.pipe()
    const writers = this.#secret.writer.pair.pipe()

    this.readable = readers.readable
    this.writable = writers.writable

    stream.readable
      .pipeTo(readers.writable)
      .then(this.#onReadClose.bind(this))
      .catch(this.#onReadError.bind(this))

    writers.readable
      .pipeTo(stream.writable)
      .then(this.#onWriteClose.bind(this))
      .catch(this.#onWriteError.bind(this))
  }

  get reader() {
    return this.#secret.reader.overt
  }

  get writer() {
    return this.#secret.writer.overt
  }

  async #onReadClose() {
    console.debug(`${this.#class.name}.onReadClose`)

    const closeEvent = new CloseEvent("close", {})
    await this.reader.dispatchEvent(closeEvent)
  }

  async #onReadError(error?: unknown) {
    console.debug(`${this.#class.name}.onReadError`, error)

    const errorEvent = new ErrorEvent("error", { error })
    await this.reader.dispatchEvent(errorEvent)
  }

  async #onWriteClose() {
    console.debug(`${this.#class.name}.onWriteClose`)

    const closeEvent = new CloseEvent("close", {})
    await this.writer.dispatchEvent(closeEvent)
  }

  async #onWriteError(error?: unknown) {
    console.debug(`${this.#class.name}.onWriteError`, error)

    const errorEvent = new ErrorEvent("error", { error })
    await this.writer.dispatchEvent(errorEvent)
  }
}
