import { WebSocketStream } from "libs/transports/websocket.js"

/**
 * Magic bytes
 */
export const TOKEN = new Uint8Array([0x12, 0x93, 0x60, 0x5d, 0x27, 0x81, 0x75, 0xf5])

export async function createWebSocketTurboStream(url: string) {
  const websocket = new WebSocket(url)

  websocket.binaryType = "arraybuffer"

  await new Promise((ok, err) => {
    websocket.addEventListener("open", ok)
    websocket.addEventListener("error", err)
  })

  websocket.send(TOKEN)

  /**
   * Session
   */
  const clientID = new Uint8Array(8)
  crypto.getRandomValues(clientID)

  websocket.send(clientID)

  return new WebSocketStream(websocket)
}

export class TurboStream {

  constructor(
    readonly stream: ReadableWritablePair<Uint8Array>
  ) { }
}