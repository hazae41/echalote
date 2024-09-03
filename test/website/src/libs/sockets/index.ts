import { Opaque, Writable } from "@hazae41/binary"
import { Box, Deferred, Stack } from "@hazae41/box"
import { Disposer } from "@hazae41/disposer"
import { Circuit } from "@hazae41/echalote"
import { Fleche } from "@hazae41/fleche"
import { Future } from "@hazae41/future"
import { Pool } from "@hazae41/piscine"
import { openAsOrThrow } from "libs/circuits"
import { SizedPool } from "libs/pool"

export async function createFlecheWebSocketOrThrow(stream: ReadableWritablePair<Opaque, Writable>, url: URL, signal = new AbortController().signal): Promise<Disposer<Fleche.WebSocket>> {
  using stack = new Stack()

  const timeout = AbortSignal.timeout(5000)
  const subsignal = AbortSignal.any([signal, timeout])

  subsignal.throwIfAborted()

  const socket = new Fleche.WebSocket(url)
  const future = new Future<void>()

  using dsocket = new Box(new Disposer(socket, () => socket.close()))

  const onOpen = () => future.resolve()
  const onError = (cause: unknown) => future.reject(new Error("Errored", { cause }))
  const onAbort = () => future.reject(new Error("Aborted", { cause: subsignal.reason }))

  socket.addEventListener("open", onOpen, { passive: true })
  stack.push(new Deferred(() => socket.removeEventListener("open", onOpen)))

  socket.addEventListener("error", onError, { passive: true })
  stack.push(new Deferred(() => socket.removeEventListener("error", onError)))

  timeout.addEventListener("abort", onAbort, { passive: true })
  stack.push(new Deferred(() => timeout.removeEventListener("abort", onAbort)))

  stream.readable.pipeTo(socket.inner.writable, { preventCancel: true }).catch(onError)
  socket.inner.readable.pipeTo(stream.writable, { preventAbort: true, preventClose: true }).catch(onError)

  await future.promise

  return dsocket.unwrapOrThrow()
}

export function createFlecheWebSocketPool(circuits: SizedPool<Circuit>, url: URL, size: number) {
  let update = Date.now()

  const pool: Pool<Disposer<Fleche.WebSocket>> = new Pool<Disposer<Fleche.WebSocket>>(async (params) => {
    const { index, signal } = params

    while (!signal.aborted) {
      const start = Date.now()

      try {
        using stack = new Box(new Stack())

        using substack = new Stack()

        const circuit = await circuits.pool.takeCryptoRandomOrThrow()
        substack.push(circuit)

        const stream = await openAsOrThrow(circuit, url.origin)
        substack.push(stream)

        const socket = await createFlecheWebSocketOrThrow(stream.get(), url, signal)
        substack.push(socket)

        const entry = new Box(new Disposer(socket.get(), () => substack[Symbol.dispose]()))
        stack.getOrThrow().push(entry)

        const onCloseOrError = async (reason?: unknown) => pool.restart(index)

        socket.get().addEventListener("close", onCloseOrError, { passive: true })
        stack.getOrThrow().push(new Deferred(() => socket.get().removeEventListener("close", onCloseOrError)))

        socket.get().addEventListener("error", onCloseOrError, { passive: true })
        stack.getOrThrow().push(new Deferred(() => socket.get().removeEventListener("error", onCloseOrError)))

        const unstack = stack.unwrapOrThrow()

        return new Disposer(entry.moveOrThrow(), () => unstack[Symbol.dispose]())
      } catch (e: unknown) {
        if (start < update)
          continue
        throw e
      }
    }

    throw new Error("Aborted", { cause: signal.reason })
  })

  const onStarted = () => {
    update = Date.now()

    for (const entry of pool.errEntries)
      pool.restart(entry.index)

    return
  }

  const stack = new Stack()

  circuits.pool.events.on("started", onStarted, { passive: true })
  stack.push(new Deferred(() => circuits.pool.events.off("started", onStarted)))

  return new Disposer(SizedPool.start(pool, size), () => stack[Symbol.dispose]())
}