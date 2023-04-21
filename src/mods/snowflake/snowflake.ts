import { KcpDuplex } from "@hazae41/kcp"
import { WebSocketStream } from "libs/transports/websocket.js"
import { SmuxDuplex } from "mods/snowflake/smux/stream.js"
import { TurboDuplex } from "mods/snowflake/turbo/stream.js"

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

  return new SmuxDuplex(new KcpDuplex(new TurboDuplex(stream)))
}
