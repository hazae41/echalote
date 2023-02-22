import { Cursor, Opaque, Writable } from "@hazae41/binary"
import { SecretSmuxReader } from "./reader.js"
import { SecretSmuxWriter } from "./writer.js"

export class SecretSmuxStream {

  selfRead = 0
  selfWrite = 0
  selfIncrement = 0

  peerConsumed = 0
  peerWindow = 65535

  readonly reader: SecretSmuxReader
  readonly writer: SecretSmuxWriter

  readonly buffer = Cursor.allocUnsafe(65535)

  constructor(
    readonly overt: SmuxStream
  ) {
    this.reader = new SecretSmuxReader(this)
    this.writer = new SecretSmuxWriter(this)
  }

  get selfWindow() {
    return this.buffer.bytes.length
  }

}

export class SmuxStream {
  readonly #class = SmuxStream

  readonly #secret: SecretSmuxStream

  readonly readable: ReadableStream<Opaque>
  readonly writable: WritableStream<Writable>

  constructor(
    readonly stream: ReadableWritablePair<Opaque, Writable>
  ) {
    this.#secret = new SecretSmuxStream(this)

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