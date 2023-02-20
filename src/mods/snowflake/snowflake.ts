import { WebSocketStream } from "libs/transports/websocket.js"
import { KcpStream } from "mods/snowflake/kcp/stream.js"
import { SmuxStream } from "mods/snowflake/smux/stream.js"
import { TurboStream } from "mods/snowflake/turbo/stream.js"

export async function createWebSocketSnowflakeStream(url: string) {
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
