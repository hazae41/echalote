import { Bytes } from "libs/bytes/bytes.js"
import { WebSocketStream } from "libs/transports/websocket.js"
import { TurboReader } from "./reader.js"
import { TurboWriter } from "./writer.js"

export async function createWebSocketTurboStream(url: string) {
  const websocket = new WebSocket(url)

  websocket.binaryType = "arraybuffer"

  await new Promise((ok, err) => {
    websocket.addEventListener("open", ok)
    websocket.addEventListener("error", err)
  })

  const stream = new WebSocketStream(websocket, {
    shouldCloseOnAbort: true,
    shouldCloseOnCancel: true,
    shouldCloseOnClose: false
  })

  return new TurboStream(stream)
}

export class TurboStream {
  readonly #class = TurboStream

  static readonly TOKEN = new Uint8Array([0x12, 0x93, 0x60, 0x5d, 0x27, 0x81, 0x75, 0xf5])

  readonly reader: TurboReader
  readonly writer: TurboWriter

  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<Uint8Array>

  readonly clientID = Bytes.random(8)

  constructor(
    readonly stream: ReadableWritablePair<Uint8Array>
  ) {
    this.reader = new TurboReader(this)
    this.writer = new TurboWriter(this)

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

  get class() {
    return this.#class
  }

  async onReadClose() {
    this.writer.terminate().catch(() => { })
  }

  async onReadError(error?: unknown) {
    this.writer.error(error).catch(() => { })
  }

  async onWriteClose() {
    this.reader.terminate().catch(() => { })
  }

  async onWriteError(error?: unknown) {
    this.reader.error(error).catch(() => { })
  }
}
