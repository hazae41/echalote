import { Cursor, Opaque, Writable } from "@hazae41/binary";
import { CloseEvent } from "libs/events/close.js";
import { ErrorEvent } from "libs/events/error.js";
import { SecretKcpReader } from "./reader.js";
import { SecretKcpWriter } from "./writer.js";

export class SecretKcpStream {

  send_counter = 0
  recv_counter = 0

  readonly reader: SecretKcpReader
  readonly writer: SecretKcpWriter

  constructor(
    readonly overt: KcpStream
  ) {
    this.reader = new SecretKcpReader(this)
    this.writer = new SecretKcpWriter(this)
  }

}

export class KcpStream {
  readonly #class = KcpStream

  readonly #secret: SecretKcpStream

  readonly readable: ReadableStream<Opaque>
  readonly writable: WritableStream<Writable>

  readonly conversation = Cursor.random(4).getUint32(true)

  constructor(
    readonly stream: ReadableWritablePair<Opaque, Writable>
  ) {
    this.#secret = new SecretKcpStream(this)

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