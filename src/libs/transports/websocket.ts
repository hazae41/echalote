import { Opaque, Writable } from "@hazae41/binary"
import { ResultableUnderlyingDefaultSource, ResultableUnderlyingSink, SuperReadableStream, SuperWritableStream } from "@hazae41/cascade"
import { Ok, Panic, Result } from "@hazae41/result"

export async function createWebSocketStream(url: string) {
  const websocket = new WebSocket(url)

  websocket.binaryType = "arraybuffer"

  await new Promise((ok, err) => {
    websocket.addEventListener("open", ok)
    websocket.addEventListener("error", err)
  })

  return WebSocketStream.tryNew(websocket, { shouldCloseOnAbort: true, shouldCloseOnCancel: true })
}

async function closeOrThrow(websocket: WebSocket) {
  if (websocket.readyState !== WebSocket.OPEN)
    return
  await new Promise<void>((ok, err) => {
    const onClose = (e: CloseEvent) => {
      if (e.wasClean)
        ok()
      else
        err(e)
    }

    websocket.addEventListener("close", onClose, { passive: true, once: true })
    websocket.close()
  })
}

export type WebSocketStreamParams =
  & WebSocketSourceParams
  & WebSocketSinkParams

export class WebSocketStream {
  readonly reader: SuperReadableStream<Opaque>
  readonly writer: SuperWritableStream<Writable>

  readonly readable: ReadableStream<Opaque>
  readonly writable: WritableStream<Writable>

  /**
   * A WebSocket stream
   * @description https://streams.spec.whatwg.org/#example-both
   */
  private constructor(
    readonly socket: WebSocket,
    readonly params: WebSocketStreamParams = {}
  ) {
    this.reader = new SuperReadableStream(new WebSocketSource(socket, params))
    this.writer = new SuperWritableStream(new WebSocketSink(socket, params))

    this.readable = this.reader.start()
    this.writable = this.writer.start()
  }

  static tryNew(socket: WebSocket, params?: WebSocketStreamParams) {
    if (socket.readyState !== WebSocket.OPEN)
      throw Panic.from(new Error(`WebSocket is not open`))
    if (socket.binaryType !== "arraybuffer")
      throw Panic.from(new Error(`WebSocket binaryType is not arraybuffer`))

    return new WebSocketStream(socket, params)
  }
}

export interface WebSocketSourceParams {
  /**
   * Whether the socket should be closed when the stream is cancelled
   * @description You don't want to reuse the socket
   */
  shouldCloseOnCancel?: boolean
}

export class WebSocketSource implements ResultableUnderlyingDefaultSource<Opaque> {

  constructor(
    readonly websocket: WebSocket,
    readonly params: WebSocketSourceParams = {}
  ) { }

  #onMessage?: (e: MessageEvent<ArrayBuffer>) => void
  #onClose?: (e: CloseEvent) => void
  #onError?: (e: Event) => void

  #onClean() {
    this.websocket.removeEventListener("message", this.#onMessage!)
    this.websocket.removeEventListener("close", this.#onClose!)
    this.websocket.removeEventListener("error", this.#onError!)
  }

  async start(controller: ReadableStreamDefaultController<Opaque>) {

    this.#onMessage = (msgEvent: MessageEvent<ArrayBuffer>) => {
      const bytes = new Uint8Array(msgEvent.data)
      // console.debug("ws <-", bytes, Bytes.toUtf8(bytes))

      try {
        controller.enqueue(new Opaque(bytes))
      } catch (e: unknown) { }
    }

    this.#onError = (event: Event) => {
      const error = new Error(`Errored`, { cause: event })

      try {
        controller.error(error)
      } catch (e: unknown) { }

      this.#onClean()
    }

    this.#onClose = (event: CloseEvent) => {
      try {
        controller.close()
      } catch (e: unknown) { }

      this.#onClean()
    }

    this.websocket.addEventListener("message", this.#onMessage, { passive: true })

    this.websocket.addEventListener("error", this.#onError, { passive: true, once: true })
    this.websocket.addEventListener("close", this.#onClose, { passive: true, once: true })

    return Ok.void()
  }

  async cancel() {
    if (this.params.shouldCloseOnCancel)
      await closeOrThrow(this.websocket)

    this.#onClean()

    return Ok.void()
  }

}

export interface WebSocketSinkParams {
  /**
   * Whether the socket should be closed when the stream is closed
   * @description You don't want to reuse the socket
   * @description You're not using request-response
   */
  shouldCloseOnClose?: boolean

  /**
   * Whether the socket should be closed when the stream is aborted
   * @description You don't want to reuse the socket
   */
  shouldCloseOnAbort?: boolean
}

export class WebSocketSink implements ResultableUnderlyingSink<Writable> {

  constructor(
    readonly websocket: WebSocket,
    readonly params: WebSocketSinkParams = {}
  ) { }

  #onClose?: (e: CloseEvent) => void
  #onError?: (e: Event) => void

  #onClean() {
    this.websocket.removeEventListener("close", this.#onClose!)
    this.websocket.removeEventListener("error", this.#onError!)
  }

  async start(controller: WritableStreamDefaultController) {

    this.#onClose = (closeEvent: CloseEvent) => {
      const error = new Error(`Closed`, { cause: closeEvent })

      try {
        controller.error(error)
      } catch (e: unknown) { }

      this.#onClean()
    }

    this.#onError = (event: Event) => {
      const error = new Error(`Errored`, { cause: event })

      try {
        controller.error(error)
      } catch (e: unknown) { }

      this.#onClean()
    }

    this.websocket.addEventListener("error", this.#onError, { passive: true, once: true })
    this.websocket.addEventListener("close", this.#onClose, { passive: true, once: true })

    return Ok.void()
  }

  async write(chunk: Writable): Promise<Result<void, unknown>> {
    return await Result.unthrow(async t => {
      const bytes = Writable.tryWriteToBytes(chunk).throw(t)
      // console.debug("ws ->", bytes, Bytes.toUtf8(bytes))
      this.websocket.send(bytes)

      return Ok.void()
    })
  }

  async abort(reason?: unknown) {
    if (this.params.shouldCloseOnAbort)
      await closeOrThrow(this.websocket)

    this.#onClean()

    return Ok.void()
  }

  async close() {
    if (this.params.shouldCloseOnClose)
      await closeOrThrow(this.websocket)

    this.#onClean()

    return Ok.void()
  }

}