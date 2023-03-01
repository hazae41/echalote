import { Cursor, Opaque, Writable } from "@hazae41/binary";
import { CloseEvent } from "libs/events/close.js";
import { ErrorEvent } from "libs/events/error.js";
import { SecretKcpReader } from "./reader.js";
import { SecretKcpWriter } from "./writer.js";

export class KcpStream {

  readonly #secret: SecretKcpStream

  constructor(
    readonly stream: ReadableWritablePair<Opaque, Writable>
  ) {
    this.#secret = new SecretKcpStream(stream)
  }

  get readable() {
    return this.#secret.readable
  }

  get writable() {
    return this.#secret.writable
  }

  get conversation() {
    return this.#secret.conversation
  }

}

export class SecretKcpStream {
  readonly #class = SecretKcpStream

  send_counter = 0
  recv_counter = 0

  readonly reader: SecretKcpReader
  readonly writer: SecretKcpWriter

  readonly readable: ReadableStream<Opaque>
  readonly writable: WritableStream<Writable>

  readonly conversation = Cursor.random(4).getUint32(true)

  constructor(
    readonly stream: ReadableWritablePair<Opaque, Writable>
  ) {
    this.reader = new SecretKcpReader(this)
    this.writer = new SecretKcpWriter(this)

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