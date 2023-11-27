import { Opaque, Writable } from "@hazae41/binary"
import { Box } from "@hazae41/box"
import { Disposer } from "@hazae41/cleaner"
import { WebSocket } from "@hazae41/fleche"
import { Future } from "@hazae41/future"
import { Mutex } from "@hazae41/mutex"
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
  const pool = new Pool<Disposer<WebSocket>>(async (params) => {
    return await Result.unthrow<Result<Disposer<Box<Disposer<WebSocket>>>, Error>>(async t => {
      const { pool, index, signal } = params
      const uuid = crypto.randomUUID()

      console.debug("waiting for stream...", uuid)

      using lock = new Box(await streams.trySync(params).then(r => r.throw(t).throw(t).inner.inner.inner.acquire()))
      const socket = await tryCreateWebSocket(url, lock.getOrThrow().inner, signal).then(r => r.throw(t))

      const lock2 = lock.moveOrThrow()

      console.debug("websocket created...", uuid)

      const onSocketClean = () => {
        console.debug("closing websocket...", uuid)
        if (socket.readyState <= socket.OPEN)
          socket.close()
        lock2.unwrapOrThrow().release()
      }

      const onCloseOrError = async (reason?: unknown) => {
        console.debug("websocket closed...", uuid, reason)
        pool.restart(index)
      }

      socket.addEventListener("close", onCloseOrError, { passive: true })
      socket.addEventListener("error", onCloseOrError, { passive: true })

      const onEntryClean = () => {
        console.debug("websocket entry closed...", uuid)
        socket.removeEventListener("close", onCloseOrError)
        socket.removeEventListener("error", onCloseOrError)
      }

      using disposable = new Box(new Disposer(socket, onSocketClean))
      return new Ok(new Disposer(disposable.moveOrThrow(), onEntryClean))
    })
  }, params)

  return new Mutex(pool)
}