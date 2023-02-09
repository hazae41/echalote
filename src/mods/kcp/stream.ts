import { Binary } from "@hazae41/binary";
import { CloseEvent } from "libs/events/close.js";
import { ErrorEvent } from "libs/events/error.js";
import { KcpReader } from "./reader.js";
import { KcpWriter } from "./writer.js";

export class KcpStream {
  readonly #class = KcpStream

  readonly reader: KcpReader
  readonly writer: KcpWriter

  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<Uint8Array>

  readonly conversation = Binary.random(4).getUint32(true)

  send_counter = 0
  recv_counter = 0

  constructor(
    readonly stream: ReadableWritablePair<Uint8Array>
  ) {
    this.reader = new KcpReader(this)
    this.writer = new KcpWriter(this)

    this.readable = this.reader.readable
    this.writable = this.writer.writable

    stream.readable
      .pipeTo(this.reader.writable)
      .then(this.onReadClose.bind(this))
      .catch(this.onReadError.bind(this))

    this.writer.readable
      .pipeTo(stream.writable)
      .then(this.onWriteClose.bind(this))
      .catch(this.onWriteError.bind(this))
  }

  async onReadClose() {
    const closeEvent = new CloseEvent("close", {})
    await this.reader.dispatchEvent(closeEvent)
  }

  async onReadError(error?: unknown) {
    console.debug(`${this.#class.name}.onReadError`, error)

    const errorEvent = new ErrorEvent("error", { error })
    await this.reader.dispatchEvent(errorEvent)
  }

  async onWriteClose() {
    const closeEvent = new CloseEvent("close", {})
    await this.writer.dispatchEvent(closeEvent)
  }

  async onWriteError(error?: unknown) {
    const errorEvent = new ErrorEvent("error", { error })
    await this.writer.dispatchEvent(errorEvent)
  }

}