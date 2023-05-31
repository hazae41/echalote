import { BinaryWriteError } from "@hazae41/binary"
import { Ciphers, TlsClientDuplex } from "@hazae41/cadenas"
import { ControllerError } from "@hazae41/cascade"
import { Circuit, TorClientDuplex } from "@hazae41/echalote"
import { Fleche } from "@hazae41/fleche"
import { Future } from "@hazae41/future"
import { Mutex } from "@hazae41/mutex"
import { Pool } from "@hazae41/piscine"
import { AbortError, CloseError, ErrorError } from "@hazae41/plume"
import { Err, Ok, Result } from "@hazae41/result"
import { AbortSignals } from "libs/signals/signals"
import { TorAndCircuits } from "mods/tor"

export async function tryCreateWebSocket(circuit: Circuit, url: URL, signal?: AbortSignal): Promise<Result<WebSocket, BinaryWriteError | CloseError | ErrorError | AbortError | ControllerError>> {
  return await Result.unthrow(async t => {
    const signal2 = AbortSignals.timeout(5_000, signal)

    const tcp = await circuit.tryOpen(url.hostname, 443).then(r => r.throw(t))
    const tls = new TlsClientDuplex(tcp, { ciphers: [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384] })
    const socket = new Fleche.WebSocket(url, undefined, { subduplex: tls })

    const future = new Future<Result<WebSocket, ErrorError | AbortError>>()

    const onOpen = () => {
      future.resolve(new Ok(socket))
    }

    const onError = (e: unknown) => {
      future.resolve(new Err(ErrorError.from(e)))
    }

    const onAbort = (e: unknown) => {
      socket.close()
      future.resolve(new Err(AbortError.from(e)))
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
  })
}

export async function tryCreateSocketLoop(circuit: Circuit, url: URL, signal?: AbortSignal) {
  return await Result.unthrow(async t => {
    while (!signal?.aborted) {
      const result = await tryCreateWebSocket(circuit, url, signal)

      if (result.isOk())
        return new Ok(result.get())

      if (!circuit.destroyed) {
        console.warn(`WebSocket creation failed`, { e: result.get() })
        await circuit.tryDestroy().then(r => r.throw(t))
        continue
      }

      return result
    }

    return new Err(AbortError.from(signal.reason))
  })
}

export async function tryGetCircuitAndCreateSocketLoop(circuits: Mutex<Pool<Circuit>>, url: URL, signal?: AbortSignal) {
  return await Result.unthrow(async t => {
    while (!signal?.aborted) {

      const circuit = await circuits.lock(async (circuits) => {
        const circuit = await circuits.tryGetCryptoRandom()
        circuit.inspectSync(circuit => circuits.delete(circuit))
        return circuit
      }).then(r => r.throw(t))

      const socketRes = await tryCreateSocketLoop(circuit, url, signal)

      if (socketRes.isOk()) {
        const socket = socketRes.get()
        return new Ok({ socket, circuit })
      }

      if (socketRes.isErr()) {
        console.warn(`WebSocket creation failed`, { e: socketRes.get() })
        await circuit.tryDestroy().then(r => r.throw(t))
        continue
      }

      return socketRes
    }

    return new Err(AbortError.from(signal.reason))
  })
}

export interface Socket {
  socket: WebSocket,
  circuit: Circuit
}

export function createSocketPool(circuitPool: Mutex<Pool<Circuit>>, params: { url: URL }) {
  const { capacity, signal } = circuitPool.inner

  const pool = new Pool<Socket>(async ({ pool, signal }) => {
    return await Result.unthrow(async t => {
      const { url } = params

      const element = await tryGetCircuitAndCreateSocketLoop(circuitPool, { url, signal }).then(r => r.throw(t))

      const onCloseOrError = async () => {
        element.socket.removeEventListener("close", onCloseOrError)
        element.socket.removeEventListener("error", onCloseOrError)

        pool.delete(element)
      }

      element.socket.addEventListener("close", onCloseOrError)
      element.socket.addEventListener("error", onCloseOrError)

      return new Ok(element)
    })
  }, { capacity, signal })

  pool.events.on("errored", async (reason) => {
    circuitPool.inner.error(reason)

    return Ok.void()
  }, { passive: true, once: true })

  return new Mutex(pool)
}

export interface TorAndCircuitsAndSockets {
  tor: TorClientDuplex
  circuits: Mutex<Pool<Circuit>>
  sockets: Mutex<Pool<Socket>>
}

export function createTorAndSocketsPool(torAndCircuitsPool: Mutex<Pool<TorAndCircuits>>, params: { url: URL }) {
  const { capacity, signal } = torAndCircuitsPool.inner

  const pool = new Pool<TorAndCircuitsAndSockets>(async ({ pool, index, signal }) => {
    const { url } = params

    const { tor, circuits } = await torAndCircuitsPool.inner.get(index)

    const sockets = createSocketPool(circuits, { url })

    const onErrored = async (reason?: unknown) => {
      sockets.inner.events.off("errored", onErrored)

      pool.error(reason)

      return Ok.void()
    }

    sockets.inner.events.on("errored", onErrored, { passive: true })

    return new Ok({ tor, circuits, sockets })
  }, { capacity, signal })

  pool.events.on("errored", async (reason) => {
    torAndCircuitsPool.inner.error(reason)

    return Ok.void()
  }, { passive: true, once: true })

  return new Mutex(pool)
}