import { KcpDuplex } from "@hazae41/kcp"
import { SmuxDuplex } from "@hazae41/smux"
import { tryCreateWebSocketStream } from "libs/transports/websocket.js"
import { TurboDuplex } from "mods/snowflake/turbo/stream.js"

export async function createWebSocketSnowflakeStream(url: string) {
  const websocket = await tryCreateWebSocketStream(url)
  return new SmuxDuplex(new KcpDuplex(new TurboDuplex(websocket)))
}
