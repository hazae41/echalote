import { BinaryWriteError } from "@hazae41/binary"
import { Ciphers, TlsClientDuplex } from "@hazae41/cadenas"
import { ControllerError } from "@hazae41/cascade"
import { Cleaner } from "@hazae41/cleaner"
import { Circuit } from "@hazae41/echalote"
import { Fleche } from "@hazae41/fleche"
import { Future } from "@hazae41/future"
import { Mutex } from "@hazae41/mutex"
import { Pool, PoolParams } from "@hazae41/piscine"
import { AbortedError, ClosedError, ErroredError } from "@hazae41/plume"
import { Err, Ok, Result } from "@hazae41/result"
import { AbortSignals } from "libs/signals/signals"

const urls = [
  new URL("wss://mainnet.infura.io/ws/v3/b6bf7d3508c941499b10025c0776eaf8"),
  new URL("wss://goerli.infura.io/ws/v3/b6bf7d3508c941499b10025c0776eaf8"),
  new URL("wss://lol.infura.io/ws/v3/b6bf7d3508c941499b10025c0776eaf8")
]

export async function tryCreateWebSocket(circuit: Circuit, url: URL, signal?: AbortSignal): Promise<Result<WebSocket, BinaryWriteError | ClosedError | ErroredError | AbortedError | ControllerError>> {
  return await Result.unthrow(async t => {
    const signal2 = AbortSignals.timeout(5_000, signal)

    const tcp = await circuit.tryOpen(url.hostname, 443).then(r => r.throw(t))
    const tls = new TlsClientDuplex(tcp, { ciphers: [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384] })
    const socket = new Fleche.WebSocket(url, undefined, { subduplex: tls })

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
  })
}

export async function tryCreateSocketLoop(circuit: Circuit, url: URL, signal?: AbortSignal) {
  for (let i = 0; !signal?.aborted && i < 3; i++) {
    const result = await tryCreateWebSocket(circuit, url, signal)

    if (result.isOk())
      return new Ok(result.get())

    if (!circuit.destroyed) {
      console.warn(`WebSocket creation failed`, { e: result.get() })
      await new Promise(ok => setTimeout(ok, 1000 * (2 ** i)))
      continue
    }

    return result
  }

  if (signal?.aborted)
    return new Err(AbortedError.from(signal.reason))
  return new Err(new AbortedError(`Took too long`))
}

export function createSocketPool(circuit: Circuit, params: PoolParams = {}) {
  const pool = new Pool<WebSocket>(async ({ pool, index, signal }) => {
    return await Result.unthrow(async t => {
      const socket = await tryCreateSocketLoop(circuit, urls[index], signal).then(r => r.throw(t))

      const onCloseOrError = () => {
        pool.delete(index)
      }

      socket.addEventListener("close", onCloseOrError, { passive: true })
      socket.addEventListener("error", onCloseOrError, { passive: true })

      const onClean = () => {
        socket.removeEventListener("close", onCloseOrError)
        socket.removeEventListener("error", onCloseOrError)
      }

      return new Ok(new Cleaner(socket, onClean))
    })
  }, params)

  return new Mutex(pool)
}

export interface Session {
  circuit: Circuit,
  sockets: Mutex<Pool<WebSocket>>
}

export function createSessionPool(circuits: Mutex<Pool<Circuit, Error>>, params: PoolParams) {
  const { capacity } = params

  const signal = AbortSignals.merge(circuits.inner.signal, params.signal)

  const pool = new Pool<Session, Error>(async ({ pool, index, signal }) => {
    return await Result.unthrow(async t => {
      const circuit = await Pool.takeCryptoRandom(circuits).then(r => r.throw(t).result.get())
      const sockets = createSocketPool(circuit, { capacity: 3, signal })

      const session = { circuit, sockets }

      const onCircuitCloseOrError = async () => {
        pool.delete(index)
        return Ok.void()
      }

      circuit.events.on("close", onCircuitCloseOrError)
      circuit.events.on("error", onCircuitCloseOrError)

      const onClean = () => {
        circuit.events.off("close", onCircuitCloseOrError)
        circuit.events.off("error", onCircuitCloseOrError)
      }

      return new Ok(new Cleaner(session, onClean))
    })
  }, { capacity, signal })

  pool.signal.addEventListener("abort", async (reason) => {
    circuits.inner.abort(reason)

    return Ok.void()
  }, { passive: true, once: true })

  return new Mutex(pool)
}