import { Bytes } from "@hazae41/bytes"
import { WebSocketStream } from "libs/transports/websocket.js"
import { KcpStream } from "mods/kcp/stream.js"
import { SmuxStream } from "mods/smux/stream.js"
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
    shouldCloseOnAbort: false,
    shouldCloseOnCancel: false,
    shouldCloseOnClose: false
  })

  return new SmuxStream(new KcpStream(new TurboStream(stream)))
}

export interface TurboStreamParams {
  clientID?: Uint8Array
}

export class TurboStream {
  readonly #class = TurboStream

  static readonly token = new Uint8Array([0x12, 0x93, 0x60, 0x5d, 0x27, 0x81, 0x75, 0xf5])

  readonly reader: TurboReader
  readonly writer: TurboWriter

  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<Uint8Array>

  readonly clientID: Uint8Array

  constructor(
    readonly stream: ReadableWritablePair<Uint8Array>,
    readonly params: TurboStreamParams = {}
  ) {
    this.clientID = params.clientID
      ? params.clientID
      : Bytes.random(8)

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
