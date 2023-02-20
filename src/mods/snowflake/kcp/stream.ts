import { Cursor } from "@hazae41/binary";
import { CloseEvent } from "libs/events/close.js";
import { ErrorEvent } from "libs/events/error.js";
import { KcpReader } from "./reader.js";
import { KcpWriter } from "./writer.js";

export class SecretKcpStream {

  send_counter = 0
  recv_counter = 0

  readonly reader = KcpReader.secret(this)
  readonly writer = KcpWriter.secret(this)

  constructor(
    readonly overt: KcpStream
  ) { }
}

export class KcpStream {
  readonly #class = KcpStream

  readonly #secret: SecretKcpStream

  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<Uint8Array>

  readonly conversation = Cursor.random(4).getUint32(true)

  constructor(
    readonly stream: ReadableWritablePair<Uint8Array>
  ) {
    this.#secret = new SecretKcpStream(this)

    this.readable = this.#secret.reader.pair.readable
    this.writable = this.#secret.writer.pair.writable

    stream.readable
      .pipeTo(this.#secret.reader.pair.writable)
      .then(this.#onReadClose.bind(this))
      .catch(this.#onReadError.bind(this))

    this.#secret.writer.pair.readable
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
    const closeEvent = new CloseEvent("close", {})
    await this.reader.dispatchEvent(closeEvent)
  }

  async #onReadError(error?: unknown) {
    console.debug(`${this.#class.name}.onReadError`, error)

    const errorEvent = new ErrorEvent("error", { error })
    await this.reader.dispatchEvent(errorEvent)
  }

  async #onWriteClose() {
    const closeEvent = new CloseEvent("close", {})
    await this.writer.dispatchEvent(closeEvent)
  }

  async #onWriteError(error?: unknown) {
    console.debug(`${this.#class.name}.onWriteError`, error)

    const errorEvent = new ErrorEvent("error", { error })
    await this.writer.dispatchEvent(errorEvent)
  }

}