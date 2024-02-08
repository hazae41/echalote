import { Opaque, Writable } from "@hazae41/binary"
import { KcpDuplex } from "@hazae41/kcp"
import { SmuxDuplex } from "@hazae41/smux"
import { TurboDuplex } from "mods/snowflake/turbo/stream.js"

export async function createSnowflakeStream(raw: { outer: ReadableWritablePair<Opaque, Writable> }): Promise<{ outer: ReadableWritablePair<Opaque, Writable> }> {
  const turbo = new TurboDuplex()
  const kcp = new KcpDuplex({ lowDelay: 100, highDelay: 1000 })
  const smux = new SmuxDuplex()

  raw.outer.readable
    .pipeTo(turbo.inner.writable)
    .catch(() => { })

  turbo.inner.readable
    .pipeTo(raw.outer.writable)
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
