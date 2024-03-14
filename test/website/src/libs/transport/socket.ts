import { Opaque, Writable } from "@hazae41/binary"
import { HalfDuplex } from "@hazae41/cascade"
import { Future } from "@hazae41/future"

export interface WebSocketDuplexParams {
  /**
   * Whether the socket should be closed when the duplex is closed
   * @description You don't want to reuse the socket
   * @description You're not using request-response
   */
  readonly shouldCloseOnClose?: boolean

  /**
   * Whether the socket should be closed when the duplex is errored
   * @description You don't want to reuse the socket
   */
  readonly shouldCloseOnError?: boolean
}

export class WebSocketDuplex {

  readonly duplex: HalfDuplex<Opaque, Writable>

  constructor(
    readonly socket: WebSocket,
    readonly params: WebSocketDuplexParams = {}
  ) {
    const { shouldCloseOnError, shouldCloseOnClose } = params

    this.duplex = new HalfDuplex<Opaque, Writable>({
      output: {
        write(message) {
          socket.send(Writable.writeToBytesOrThrow(message))
        },
      },
      close() {
        if (!shouldCloseOnClose)
          return

        try {
          socket.close()
        } catch { }
      },
      error() {
        if (!shouldCloseOnError)
          return

        try {
          socket.close()
        } catch { }
      }
    })

    socket.addEventListener("close", () => this.duplex.close())
    socket.addEventListener("error", e => this.duplex.error(e))

    socket.addEventListener("message", async (e: MessageEvent<string | ArrayBuffer>) => {
      if (typeof e.data === "string")
        return

      const bytes = new Uint8Array(e.data)
      const opaque = new Opaque(bytes)

      this.duplex.input.enqueue(opaque)
    })
  }

  [Symbol.dispose]() {
    this.close()
  }

  get outer() {
    return this.duplex.outer
  }

  get closing() {
    return this.duplex.closing
  }

  get closed() {
    return this.duplex.closed
  }

  error(reason?: unknown) {
    this.duplex.error(reason)
  }

  close() {
    this.duplex.close()
  }

}

export async function createWebSocketDuplex(url: string) {
  const socket = new WebSocket(url)
  socket.binaryType = "arraybuffer"

  const future = new Future<void>()

  const onOpen = () => future.resolve()
  const onError = (e: Event) => future.reject(e)

  try {
    socket.addEventListener("open", onOpen, { passive: true })
    socket.addEventListener("error", onError, { passive: true })

    await future.promise

    return new WebSocketDuplex(socket)
  } finally {
    socket.removeEventListener("open", onOpen)
    socket.removeEventListener("error", onError)
  }
}