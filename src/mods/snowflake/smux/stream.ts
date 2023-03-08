import { Cursor, Opaque, Writable } from "@hazae41/binary"
import { SecretSmuxReader } from "./reader.js"
import { SecretSmuxWriter } from "./writer.js"

export class SmuxDuplex {

  readonly #secret: SecretSmuxDuplex

  constructor(
    readonly stream: ReadableWritablePair<Opaque, Writable>
  ) {
    this.#secret = new SecretSmuxDuplex(stream)
  }

  get readable() {
    return this.#secret.readable
  }

  get writable() {
    return this.#secret.writable
  }

}

export class SecretSmuxDuplex {
  readonly #class = SecretSmuxDuplex

  selfRead = 0
  selfWrite = 0
  selfIncrement = 0

  peerConsumed = 0
  peerWindow = 65535

  readonly reader: SecretSmuxReader
  readonly writer: SecretSmuxWriter

  readonly readable: ReadableStream<Opaque>
  readonly writable: WritableStream<Writable>

  readonly buffer = Cursor.allocUnsafe(65535)

  readonly streamID = 3

  constructor(
    readonly stream: ReadableWritablePair<Opaque, Writable>
  ) {
    this.reader = new SecretSmuxReader(this)
    this.writer = new SecretSmuxWriter(this)

    const read = this.reader.stream.start()
    const write = this.writer.stream.start()

    this.readable = read.readable
    this.writable = write.writable

    stream.readable
      .pipeTo(read.writable)
      .then(this.#onReadClose.bind(this))
      .catch(this.#onReadError.bind(this))

    write.readable
      .pipeTo(stream.writable)
      .then(this.#onWriteClose.bind(this))
      .catch(this.#onWriteError.bind(this))
  }

  get selfWindow() {
    return this.buffer.bytes.length
  }

  async #onReadClose() {
    console.debug(`${this.#class.name}.onReadClose`)

    this.reader.stream.closed = {}

    const closeEvent = new CloseEvent("close", {})
    await this.reader.events.dispatchEvent(closeEvent, "close")
  }

  async #onReadError(reason?: unknown) {
    console.debug(`${this.#class.name}.onReadError`, reason)

    this.reader.stream.closed = { reason }
    this.writer.stream.error(reason)

    const error = new Error(`Errored`, { cause: reason })
    const errorEvent = new ErrorEvent("error", { error })
    await this.reader.events.dispatchEvent(errorEvent, "error")
  }

  async #onWriteClose() {
    console.debug(`${this.#class.name}.onWriteClose`)

    this.writer.stream.closed = {}

    const closeEvent = new CloseEvent("close", {})
    await this.writer.events.dispatchEvent(closeEvent, "close")
  }

  async #onWriteError(reason?: unknown) {
    console.debug(`${this.#class.name}.onWriteError`, reason)

    this.writer.stream.closed = { reason }
    this.reader.stream.error(reason)

    const error = new Error(`Errored`, { cause: reason })
    const errorEvent = new ErrorEvent("error", { error })
    await this.writer.events.dispatchEvent(errorEvent, "error")
  }

}