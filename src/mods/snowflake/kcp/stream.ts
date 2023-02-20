import { Cursor } from "@hazae41/binary";
import { CloseEvent } from "libs/events/close.js";
import { ErrorEvent } from "libs/events/error.js";
import { KcpReader, PrivateKcpReader } from "./reader.js";
import { KcpWriter, PrivateKcpWriter } from "./writer.js";

export class PrivateKcpStream {

  readonly reader: PrivateKcpReader
  readonly writer: PrivateKcpWriter

  send_counter = 0
  recv_counter = 0

  constructor(
    readonly outer: KcpStream
  ) {
    this.reader = new PrivateKcpReader(outer, this)
    this.writer = new PrivateKcpWriter(outer, this)
  }
}

export class KcpStream {
  readonly #class = KcpStream

  readonly reader = new KcpReader()
  readonly writer = new KcpWriter()

  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<Uint8Array>

  readonly conversation = Cursor.random(4).getUint32(true)

  readonly #privates = new PrivateKcpStream(this)

  constructor(
    readonly stream: ReadableWritablePair<Uint8Array>
  ) {
    this.readable = this.#privates.reader.pair.readable
    this.writable = this.#privates.writer.pair.writable

    stream.readable
      .pipeTo(this.#privates.reader.pair.writable)
      .then(this.#onReadClose.bind(this))
      .catch(this.#onReadError.bind(this))

    this.#privates.writer.pair.readable
      .pipeTo(stream.writable)
      .then(this.#onWriteClose.bind(this))
      .catch(this.#onWriteError.bind(this))
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
    const errorEvent = new ErrorEvent("error", { error })
    await this.writer.dispatchEvent(errorEvent)
  }

}