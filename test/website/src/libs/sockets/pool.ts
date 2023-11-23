import { Opaque, Writable } from "@hazae41/binary"
import { Disposer } from "@hazae41/cleaner"
import { WebSocket } from "@hazae41/fleche"
import { Future } from "@hazae41/future"
import { Mutex } from "@hazae41/mutex"
import { Pool, PoolParams, Retry, tryLoop } from "@hazae41/piscine"
import { AbortedError, ErroredError } from "@hazae41/plume"
import { Err, Ok, Result } from "@hazae41/result"
import { AbortSignals } from "libs/signals/signals"

export async function tryCreateWebSocket(url: URL, stream: ReadableWritablePair<Opaque, Writable>, signal?: AbortSignal): Promise<Result<WebSocket, Error>> {
  const signal2 = AbortSignals.timeout(30_000, signal)

  const socket = new WebSocket(url)

  stream.readable.pipeTo(socket.inner.writable, { preventCancel: true }).catch(() => { })
  socket.inner.readable.pipeTo(stream.writable, { preventAbort: true, preventClose: true }).catch(() => { })

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
    signal2.addEventListener("abort", onAbort, { passive: true })

    return await future.promise
  } finally {
    socket.removeEventListener("open", onOpen)
    socket.removeEventListener("error", onError)
    signal2.removeEventListener("abort", onAbort)
  }
}

export function createSocketPool(url: URL, streams: Mutex<Pool<Disposer<Mutex<ReadableWritablePair<Opaque, Writable>>>, Error>>, params: PoolParams = {}) {
  const pool = new Pool<Disposer<WebSocket>>(async ({ pool, index, signal }) => {
    return await Result.unthrow(async t => {
      const stream = await Pool.takeCryptoRandom(streams).then(r => r.throw(t).result.get().inner.acquire())

      console.log("creating websocket...")

      const socket = await tryLoop(async () => {
        return await tryCreateWebSocket(url, stream.inner, signal).then(r => r.mapErrSync(Retry.new))
      }).then(r => r.throw(t))

      const onCloseOrError = async (reason?: unknown) => {
        console.error(reason)
        await pool.restart(index)
      }

      socket.addEventListener("close", onCloseOrError, { passive: true })
      socket.addEventListener("error", onCloseOrError, { passive: true })

      const onClean = () => {
        socket.removeEventListener("close", onCloseOrError)
        socket.removeEventListener("error", onCloseOrError)

        stream.release()
      }

      return new Ok(new Disposer(socket, onClean))
    })
  }, params)

  return new Mutex(pool)
}