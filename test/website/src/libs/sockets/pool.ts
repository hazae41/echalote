import { BinaryWriteError } from "@hazae41/binary"
import { Ciphers, TlsClientDuplex } from "@hazae41/cadenas"
import { ControllerError } from "@hazae41/cascade"
import { Circuit } from "@hazae41/echalote"
import { Fleche } from "@hazae41/fleche"
import { Future } from "@hazae41/future"
import { Mutex } from "@hazae41/mutex"
import { Pool, PoolParams } from "@hazae41/piscine"
import { AbortError, CloseError, ErrorError } from "@hazae41/plume"
import { Err, Ok, Result } from "@hazae41/result"
import { AbortSignals } from "libs/signals/signals"

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

      const circuit = await Pool
        .takeCryptoRandom(circuits)
        .then(r => r.throw(t))

      const result = await tryCreateSocketLoop(circuit, url, signal)

      if (result.isOk())
        return new Ok({ circuit, socket: result.get() })

      if (result.isErr()) {
        console.warn(`WebSocket creation failed`, { e: result.get() })
        await circuit.tryDestroy().then(r => r.throw(t))
        continue
      }

      return result
    }

    return new Err(AbortError.from(signal.reason))
  })
}

export interface SocketAndCircuit {
  socket: WebSocket,
  circuit: Circuit
}

export function createSocketAndCircuitPool(circuits: Mutex<Pool<Circuit>>, params: PoolParams & { url: URL }) {
  const { capacity } = params

  const signal = AbortSignals.merge(circuits.inner.signal, params.signal)

  const pool = new Pool<SocketAndCircuit>(async ({ pool, signal }) => {
    return await Result.unthrow(async t => {
      const { url } = params

      const socketAndCircuit = await tryGetCircuitAndCreateSocketLoop(circuits, url, signal).then(r => r.throw(t))

      const onCloseOrError = async () => {
        socketAndCircuit.socket.removeEventListener("close", onCloseOrError)
        socketAndCircuit.socket.removeEventListener("error", onCloseOrError)

        pool.delete(socketAndCircuit)
      }

      socketAndCircuit.socket.addEventListener("close", onCloseOrError)
      socketAndCircuit.socket.addEventListener("error", onCloseOrError)

      return new Ok(socketAndCircuit)
    })
  }, { capacity, signal })

  pool.events.on("errored", async (reason) => {
    circuits.inner.error(reason)

    return Ok.void()
  }, { passive: true, once: true })

  return new Mutex(pool)
}