import { SmuxReader } from "./reader.js"
import { SmuxWriter } from "./writer.js"

export class SmuxStream {

  readonly reader: SmuxReader
  readonly writer: SmuxWriter

  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<Uint8Array>

  constructor(
    readonly stream: ReadableWritablePair<Uint8Array>
  ) {
    this.reader = new SmuxReader(this)
    this.writer = new SmuxWriter(this)

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
    console.log(error)

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