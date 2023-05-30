import { Ciphers, TlsClientDuplex } from "@hazae41/cadenas"
import { Circuit, TorClientDuplex } from "@hazae41/echalote"
import { Fleche } from "@hazae41/fleche"
import { Future } from "@hazae41/future"
import { Mutex } from "@hazae41/mutex"
import { Pool } from "@hazae41/piscine"
import { AbortError } from "@hazae41/plume"
import { Ok } from "@hazae41/result"
import { AbortSignals } from "libs/signals/signals"
import { TorAndCircuits } from "mods/tor"

export async function createWebSocket(circuit: Circuit, params: { url: URL, signal?: AbortSignal }) {
  const signal = AbortSignals.timeout(5_000, params.signal)

  const tcp = await circuit.tryOpen(params.url.hostname, 443, { signal }).then(r => r.unwrap())
  const tls = new TlsClientDuplex(tcp, { ciphers: [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384] })
  const socket = new Fleche.WebSocket(params.url, undefined, { subduplex: tls })

  const future = new Future()

  try {
    socket.addEventListener("open", future.resolve, { passive: true })
    socket.addEventListener("error", future.reject, { passive: true })

    await future.promise
  } finally {
    socket.removeEventListener("open", future.resolve)
    socket.removeEventListener("error", future.reject)
  }

  return socket
}

export async function createWebSocketLoopOrThrow(circuits: Mutex<Pool<Circuit>>, params: { url: URL, signal?: AbortSignal }) {
  while (!params.signal?.aborted) {
    try {
      const circuit = await circuits.lock(async (circuits) => {
        const circuit = await circuits.tryGetCryptoRandom()
        circuit.inspectSync(circuit => circuits.delete(circuit))
        return circuit
      }).then(r => r.unwrap())

      const socket = await createWebSocket(circuit, params)

      return { socket, circuit }
    } catch (e: unknown) {
      console.warn(`WebSocket creation failed`, { e })
      continue
    }
  }

  throw AbortError.from(params.signal.reason)
}

export interface Socket {
  socket: WebSocket,
  circuit: Circuit
}

export function createSocketPool(circuitPool: Mutex<Pool<Circuit>>, params: { url: URL }) {
  const { capacity, signal } = circuitPool.inner

  const pool = new Pool<Socket>(async ({ pool, signal }) => {
    const { url } = params

    const element = await createWebSocketLoopOrThrow(circuitPool, { url, signal })

    const onCloseOrError = async () => {
      element.socket.removeEventListener("close", onCloseOrError)
      element.socket.removeEventListener("error", onCloseOrError)

      pool.delete(element)
    }

    element.socket.addEventListener("close", onCloseOrError)
    element.socket.addEventListener("error", onCloseOrError)

    return new Ok(element)
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