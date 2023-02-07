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
    /**
     * NOOP
     */
  }

  async onReadError(error?: unknown) {
    console.error(error)
    /**
     * NOOP
     */
  }

  async onWriteClose() {
    /**
     * NOOP
     */
  }

  async onWriteError(error?: unknown) {
    /**
     * NOOP
     */
  }

}