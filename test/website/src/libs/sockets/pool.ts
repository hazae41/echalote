import { Opaque, Writable } from "@hazae41/binary"
import { Box } from "@hazae41/box"
import { Disposer } from "@hazae41/cleaner"
import { Circuit } from "@hazae41/echalote"
import { WebSocket } from "@hazae41/fleche"
import { Future } from "@hazae41/future"
import { Mutex } from "@hazae41/mutex"
import { None } from "@hazae41/option"
import { Pool, PoolParams } from "@hazae41/piscine"
import { AbortedError, ErroredError } from "@hazae41/plume"
import { Err, Ok, Result } from "@hazae41/result"
import { tryOpenAs } from "libs/circuits/circuits"
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

export function createSocketPool(url: URL, circuits: Mutex<Pool<Circuit>>, params: PoolParams = {}) {
  let update = Date.now()

  const pool = new Pool<Disposer<WebSocket>>(async (params) => {
    const { pool, index, signal } = params
    const uuid = crypto.randomUUID()

    while (true) {
      const start = Date.now()

      const result = await Result.unthrow<Result<Disposer<Box<Disposer<WebSocket>>>, Error>>(async t => {
        console.log("socket!!!", "waiting for stream...", uuid)

        using circuit = await Pool.tryTakeCryptoRandom(circuits).then(r => r.throw(t).throw(t).inner)

        console.log("creating stream...", uuid)

        using stream = new Box(await tryOpenAs(circuit.inner, url.origin).then(r => r.throw(t)))

        console.log("socket!!!", "creating...", uuid)

        const socket = await tryCreateWebSocket(url, stream.getOrThrow().inner, signal).then(r => r.throw(t))

        const circuit2 = circuit.moveOrThrow()
        const stream2 = stream.moveOrThrow()

        console.log("socket!!!", "created...", uuid)

        const onSocketClean = async () => {
          console.log("socket!!!", "closing...", uuid)
          try { socket.close() } catch { }
          console.log("socket!!!", "unlokcing...", uuid)
          stream2[Symbol.dispose]()
          circuit2[Symbol.dispose]()
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

      if (start < update)
        continue

      return result
    }
  }, params)

  circuits.inner.events.on("started", async i => {
    update = Date.now()

    for (let i = 0; i < pool.capacity; i++) {
      const child = pool.tryGetSync(i)

      if (child.isErr())
        continue

      if (child.inner.isErr())
        pool.restart(i)

      continue
    }

    return new None()
  }, { passive: true })

  return new Mutex(pool)
}