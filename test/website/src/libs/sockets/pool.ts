import { Ciphers, TlsClientDuplex } from "@hazae41/cadenas"
import { Circuit } from "@hazae41/echalote"
import { Fleche } from "@hazae41/fleche"
import { Future } from "@hazae41/future"
import { Mutex } from "@hazae41/mutex"
import { Pool, PoolParams } from "@hazae41/piscine"
import { Ok } from "@hazae41/result"

export async function createWebSocket(url: URL, circuit: Circuit, signal?: AbortSignal) {
  const tcp = (await circuit.tryOpen(url.hostname, 443, { signal })).unwrap()
  const tls = new TlsClientDuplex(tcp, { ciphers: [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384] })
  const socket = new Fleche.WebSocket(url, undefined, { subduplex: tls })

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

export function createWebSocketPool(url: URL, circuits: Mutex<Pool<Circuit>>, params: PoolParams = {}) {
  return new Pool<WebSocket>(async ({ pool }) => {
    const circuit = await circuits.lock(async (circuits) => {
      const circuit = await circuits.tryGetCryptoRandom()
      circuit.inspectSync(circuit => circuits.delete(circuit))
      return circuit
    }).then(r => r.unwrap())

    const signal = AbortSignal.timeout(5000)
    const socket = await createWebSocket(url, circuit, signal)

    const onCloseOrError = async () => {
      socket.removeEventListener("close", onCloseOrError)
      socket.removeEventListener("error", onCloseOrError)

      await pool.delete(socket)
    }

    socket.addEventListener("close", onCloseOrError)
    socket.addEventListener("error", onCloseOrError)

    return new Ok(socket)
  }, params)
}