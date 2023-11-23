import { Opaque, Writable } from "@hazae41/binary"
import { KcpDuplex } from "@hazae41/kcp"
import { SmuxDuplex } from "@hazae41/smux"
import { createWebSocketStream } from "libs/transports/websocket.js"
import { TurboDuplex } from "mods/snowflake/turbo/stream.js"

export interface InnerDuplex {
  readonly outer: ReadableWritablePair<Opaque, Writable>
}

export async function createWebSocketSnowflakeStream(url: string): Promise<InnerDuplex> {
  const websocket = await createWebSocketStream(url)

  const turbo = new TurboDuplex()
  const kcp = new KcpDuplex({ lowDelay: 100, highDelay: 1000 })
  const smux = new SmuxDuplex()

  websocket.outer.readable
    .pipeTo(turbo.inner.writable)
    .catch(() => { })

  turbo.inner.readable
    .pipeTo(websocket.outer.writable)
    .catch(() => { })

  turbo.outer.readable
    .pipeTo(kcp.inner.writable)
    .catch(() => { })

  kcp.inner.readable
    .pipeTo(turbo.outer.writable)
    .catch(() => { })

  kcp.outer.readable
    .pipeTo(smux.inner.writable)
    .catch(() => { })

  smux.inner.readable
    .pipeTo(kcp.outer.writable)
    .catch(() => { })

  return smux
}
