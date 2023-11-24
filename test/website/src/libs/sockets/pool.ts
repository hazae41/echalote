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
  const timeout = AbortSignals.timeout(5_000)

  const socket = new WebSocket(url)

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
  const pool = new Pool<Disposer<WebSocket>>(async ({ pool, index }) => {
    return await tryLoop(async () => {
      return await Result.unthrow<Result<Disposer<Box<Disposer<WebSocket>>>, Error>>(async t => {
        using stream = new Box(await streams.tryGet(index % streams.capacity).then(r => r.throw(t).throw(t).inner.inner.acquire()))

        console.log("creating websocket...")

        const socket = await tryLoop(async () => {
          return await Result.runOrDoubleWrap(async () => {
            return await tryCreateWebSocket(url, stream.getOrThrow().inner).then(r => r.inspectErrSync(e => console.warn("Retrying...", e)).mapErrSync(Retry.new))
          }).then(r => r.mapErrSync(Retry.new))
        }).then(r => r.inspectErrSync(e => console.warn("Giving up", e)).throw(t))

        const onSocketClean = () => {
          console.log("closing websocket...")
          socket.close()
          stream.inner.release()
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

        stream.moveOrThrow()

        using disposable = new Box(new Disposer(socket, onSocketClean))
        return new Ok(new Disposer(disposable.moveOrThrow(), onEntryClean))
      }).then(r => r.mapErrSync(Retry.new))
    })

  }, params)

  return new Mutex(pool)
}