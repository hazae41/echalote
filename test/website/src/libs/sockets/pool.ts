import { Opaque, Writable } from "@hazae41/binary"
import { Box } from "@hazae41/box"
import { Disposer } from "@hazae41/cleaner"
import { WebSocket } from "@hazae41/fleche"
import { Future } from "@hazae41/future"
import { Mutex } from "@hazae41/mutex"
import { None } from "@hazae41/option"
import { Pool, PoolParams } from "@hazae41/piscine"
import { AbortedError, ErroredError } from "@hazae41/plume"
import { Err, Ok, Result } from "@hazae41/result"
import { AbortSignals } from "libs/signals/signals"

export async function tryCreateWebSocket(url: URL, stream: ReadableWritablePair<Opaque, Writable>, signal?: AbortSignal): Promise<Result<WebSocket, Error>> {
  const timeout = AbortSignals.timeout(5_000, signal)

  const socket = new WebSocket(url)

  const future = new Future<Result<WebSocket, ErroredError | AbortedError>>()

  const onOpen = () => {
    future.resolve(new Ok(socket))
  }

  const onError = (e: unknown) => {
    future.resolve(new Err(ErroredError.from(e)))
  }

  const onAbort = (e: unknown) => {
    try { socket.close() } catch { }
    future.resolve(new Err(AbortedError.from(e)))
  }

  try {
    socket.addEventListener("open", onOpen, { passive: true })
    socket.addEventListener("error", onError, { passive: true })
    timeout.addEventListener("abort", onAbort, { passive: true })

    if (signal?.aborted)
      return new Err(new AbortedError())

    stream.readable.pipeTo(socket.inner.writable, { preventCancel: true }).catch(onError)
    socket.inner.readable.pipeTo(stream.writable, { preventAbort: true, preventClose: true }).catch(onError)

    return await future.promise
  } finally {
    socket.removeEventListener("open", onOpen)
    socket.removeEventListener("error", onError)
    timeout.removeEventListener("abort", onAbort)
  }
}

export function createSocketPool(url: URL, streams: Pool<Disposer<Mutex<ReadableWritablePair<Opaque, Writable>>>>, params: PoolParams = {}) {
  let updates = new Array(params.capacity).fill(new Date(0))

  const pool = new Pool<Disposer<WebSocket>>(async (params) => {
    const { pool, index, signal } = params
    const uuid = crypto.randomUUID()

    while (true) {
      const start = Date.now()

      const result = await Result.unthrow<Result<Disposer<Box<Disposer<WebSocket>>>, Error>>(async t => {
        console.log("socket!!!", "waiting for stream...", uuid)

        using lock = new Box(await streams.tryGetOrWait(index % streams.capacity, signal).then(r => r.throw(t).throw(t).inner.inner.inner.acquire()))

        console.log("socket!!!", "creating...", uuid)

        const socket = await tryCreateWebSocket(url, lock.getOrThrow().inner, signal).then(r => r.throw(t))

        const lock2 = lock.moveOrThrow()

        console.log("socket!!!", "created...", uuid)

        const onSocketClean = async () => {
          console.log("socket!!!", "closing...", uuid)
          try { socket.close() } catch { }
          await new Promise(ok => setTimeout(ok, 1000))
          console.log("socket!!!", "unlokcing...", uuid)
          lock2.unwrapOrThrow().release()
        }

        const onCloseOrError = async (reason?: unknown) => {
          console.log("socket!!!", "closed...", uuid, reason)
          pool.restart(index)
        }

        socket.addEventListener("close", onCloseOrError, { passive: true })
        socket.addEventListener("error", onCloseOrError, { passive: true })

        const onEntryClean = () => {
          console.log("socket!!!", "entry closed...", uuid)
          socket.removeEventListener("close", onCloseOrError)
          socket.removeEventListener("error", onCloseOrError)
        }

        using disposable = new Box(new Disposer(socket, onSocketClean))
        return new Ok(new Disposer(disposable.moveOrThrow(), onEntryClean))
      }).then(r => r.inspectErrSync(e => console.warn("socket!!!", "errored", uuid, { e })))

      if (result.isOk())
        return result

      if (start < updates[index])
        continue

      return result
    }
  }, params)

  streams.events.on("started", async i => {
    const index = i % streams.capacity

    updates[index] = Date.now()

    const child = pool.tryGetSync(index)

    if (child.isErr())
      return new None()

    if (child.inner.isErr())
      pool.restart(i)

    return new None()
  }, { passive: true })

  return new Mutex(pool)
}