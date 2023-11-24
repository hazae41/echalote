import { Opaque, Writable } from "@hazae41/binary"
import { Box } from "@hazae41/box"
import { Disposer } from "@hazae41/cleaner"
import { WebSocket } from "@hazae41/fleche"
import { Future } from "@hazae41/future"
import { Mutex } from "@hazae41/mutex"
import { Pool, PoolParams, Retry, tryLoop } from "@hazae41/piscine"
import { AbortedError, ErroredError } from "@hazae41/plume"
import { Err, Ok, Result } from "@hazae41/result"
import { AbortSignals } from "libs/signals/signals"

export async function tryCreateWebSocket(url: URL, stream: ReadableWritablePair<Opaque, Writable>, signal?: AbortSignal): Promise<Result<WebSocket, Error>> {
  const timeout = AbortSignals.timeout(30_000)

  const socket = new WebSocket(url)

  stream.readable.pipeTo(socket.inner.writable, { preventCancel: true, preventAbort: true, preventClose: true }).catch(console.warn)
  socket.inner.readable.pipeTo(stream.writable, { preventCancel: true, preventAbort: true, preventClose: true }).catch(console.warn)

  const future = new Future<Result<WebSocket, ErroredError | AbortedError>>()

  const onOpen = () => {
    future.resolve(new Ok(socket))
  }

  const onError = (e: unknown) => {
    future.resolve(new Err(ErroredError.from(e)))
  }

  const onAbort = (e: unknown) => {
    socket.close()
    future.resolve(new Err(AbortedError.from(e)))
  }

  try {
    socket.addEventListener("open", onOpen, { passive: true })
    socket.addEventListener("error", onError, { passive: true })
    timeout.addEventListener("abort", onAbort, { passive: true })

    return await future.promise
  } finally {
    socket.removeEventListener("open", onOpen)
    socket.removeEventListener("error", onError)
    timeout.removeEventListener("abort", onAbort)
  }
}

export function createSocketPool(url: URL, streams: Pool<Disposer<Mutex<ReadableWritablePair<Opaque, Writable>>>>, params: PoolParams = {}) {
  let count = 0
  const pool = new Pool<Disposer<WebSocket>>(async ({ pool, index }) => {
    return await Result.unthrow(async t => {
      using stream = await streams.tryGet(index % streams.capacity).then(r => r.throw(t).throw(t).inner.inner.acquire())

      console.log("creating websocket...")

      if (count++ > 0)
        await new Promise(ok => setTimeout(ok, 5000))

      const socket = await tryLoop(async () => {
        return await tryCreateWebSocket(url, stream.inner).then(r => r.mapErrSync(Retry.new))
      }).then(r => r.throw(t))

      const onSocketClean = () => {
        console.log("closing websocket...")
        socket.close()
        stream.release()
      }

      const onCloseOrError = async (reason?: unknown) => {
        console.error("websocket closed...", reason)
        await pool.restart(index)
      }

      socket.addEventListener("close", onCloseOrError, { passive: true })
      socket.addEventListener("error", onCloseOrError, { passive: true })

      const onEntryClean = () => {
        console.log("entry closed...")
        socket.removeEventListener("close", onCloseOrError)
        socket.removeEventListener("error", onCloseOrError)
      }

      using disposable = new Box(new Disposer(socket, onSocketClean))
      return new Ok(new Disposer(disposable.moveOrThrow(), onEntryClean))
    })
  }, params)

  return new Mutex(pool)
}