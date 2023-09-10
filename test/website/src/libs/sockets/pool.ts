import { Ciphers, TlsClientDuplex } from "@hazae41/cadenas"
import { Disposer } from "@hazae41/cleaner"
import { Circuit } from "@hazae41/echalote"
import { Fleche } from "@hazae41/fleche"
import { Future } from "@hazae41/future"
import { Mutex } from "@hazae41/mutex"
import { None } from "@hazae41/option"
import { Pool, PoolParams } from "@hazae41/piscine"
import { AbortedError, ErroredError } from "@hazae41/plume"
import { Err, Ok, Result } from "@hazae41/result"
import { AbortSignals } from "libs/signals/signals"

const urls = [
  new URL("wss://relay.walletconnect.com/?auth=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJkaWQ6a2V5Ono2TWtyTXdjaUFNQ245eW5Hb2dyeDFuQ3FWd1ZMVGVTN0RqOFlnWU5mSFdDUFNOWCIsInN1YiI6IjlkZTc3Zjc0MjRiOTBlMTViNTM1MzQ3NTljNDU5ZmI4NmYxZjJkNDdjZTY1MjU5NjFkOWE3ZmRiYTg2Y2FmZjEiLCJhdWQiOiJ3c3M6Ly9yZWxheS53YWxsZXRjb25uZWN0LmNvbSIsImlhdCI6MTY5MzA0MzU4NywiZXhwIjoxNjkzMTI5OTg3fQ.mp6zjHTzQta5FvmjOjXOmfXIwobO9k2uot6kW202ksqUjTwzSf796k9X_AoBKhpQqu2291SNjLgNdL2iEFRqBA&projectId=a6e0e589ca8c0326addb7c877bbb0857"),
]

export async function tryCreateWebSocket(circuit: Circuit, url: URL, signal?: AbortSignal): Promise<Result<WebSocket, Error>> {
  return await Result.unthrow(async t => {
    const signal2 = AbortSignals.timeout(5_000, signal)

    const tcp = await circuit.tryOpen(url.hostname, 443).then(r => r.throw(t))
    const tls = new TlsClientDuplex(tcp, { ciphers: [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384], host_name: url.hostname })
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
  const pool = new Pool<Disposer<WebSocket>>(async ({ pool, index, signal }) => {
    return await Result.unthrow(async t => {
      const socket = await tryCreateSocketLoop(circuit, urls[index], signal).then(r => r.throw(t))

      const onCloseOrError = () => {
        pool.restart(index)
      }

      socket.addEventListener("close", onCloseOrError, { passive: true })
      socket.addEventListener("error", onCloseOrError, { passive: true })

      const onClean = () => {
        socket.removeEventListener("close", onCloseOrError)
        socket.removeEventListener("error", onCloseOrError)
      }

      return new Ok(new Disposer(socket, onClean))
    })
  }, params)

  return new Mutex(pool)
}

export interface Session {
  circuit: Circuit,
  sockets: Mutex<Pool<Disposer<WebSocket>>>
}

export function createSessionPool(circuits: Mutex<Pool<Disposer<Circuit>, Error>>, params: PoolParams) {
  const { capacity } = params

  const signal = AbortSignals.merge(circuits.inner.signal, params.signal)

  const pool = new Pool<Disposer<Session>, Error>(async ({ pool, index, signal }) => {
    return await Result.unthrow(async t => {
      const circuit = await Pool.takeCryptoRandom(circuits).then(r => r.throw(t).result.get())
      const sockets = createSocketPool(circuit.inner, { capacity: 3, signal })

      const session: Session = { circuit: circuit.inner, sockets }

      const onCircuitCloseOrError = async () => {
        pool.restart(index)
        return new None()
      }

      circuit.inner.events.on("close", onCircuitCloseOrError)
      circuit.inner.events.on("error", onCircuitCloseOrError)

      const onClean = () => {
        circuit.inner.events.off("close", onCircuitCloseOrError)
        circuit.inner.events.off("error", onCircuitCloseOrError)
      }

      return new Ok(new Disposer(session, onClean))
    })
  }, { capacity, signal })

  return new Mutex(pool)
}