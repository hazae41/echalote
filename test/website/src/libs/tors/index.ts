import { Box, Deferred, Stack } from "@hazae41/box";
import { Disposer } from "@hazae41/disposer";
import { createSnowflakeStream, TorClientDuplex } from "@hazae41/echalote";
import { Pool } from "@hazae41/piscine";
import { SizedPool } from "libs/pool";
import { createWebSocketDuplex } from "libs/transport/socket";

export async function createTorOrThrow(): Promise<TorClientDuplex> {
  const ws = await createWebSocketDuplex("wss://snowflake.torproject.net/")

  const tcp = createSnowflakeStream(ws)
  // const tcp = await createMeekStream("http://localhost:8080/")

  const tor = new TorClientDuplex()

  tcp.outer.readable.pipeTo(tor.inner.writable).catch(console.error)
  tor.inner.readable.pipeTo(tcp.outer.writable).catch(console.error)

  await tor.waitOrThrow()

  return tor
}

export function createTorEntry(pool: Pool<TorClientDuplex>, index: number, tor: TorClientDuplex) {
  using stack = new Box(new Stack())

  const entry = new Box(tor)
  stack.getOrThrow().push(tor)

  const onCloseOrError = async (reason?: unknown) => void pool.restart(index)

  stack.getOrThrow().push(new Deferred(tor.events.on("close", onCloseOrError, { passive: true })))
  stack.getOrThrow().push(new Deferred(tor.events.on("error", onCloseOrError, { passive: true })))

  const unstack = stack.unwrapOrThrow()

  return new Disposer(entry, () => unstack[Symbol.dispose]())
}

export function createTorPool(size: number) {
  const pool: Pool<TorClientDuplex> = new Pool<TorClientDuplex>(async (params) => {
    const { index } = params

    const tor = await createTorOrThrow()

    return createTorEntry(pool, index, tor)
  })

  return new Disposer(SizedPool.start(pool, size), () => { })
}