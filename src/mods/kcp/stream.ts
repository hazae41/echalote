import { Binary } from "@hazae41/binary";
import { KcpReader } from "./reader.js";
import { KcpWriter } from "./writer.js";

export class KcpStream {

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
    /**
     * NOOP
     */
  }

  async onReadError(error?: unknown) {
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