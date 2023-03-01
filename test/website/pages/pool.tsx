import { Ciphers, TlsStream } from "@hazae41/cadenas";
import { Circuit, CircuitPool, createWebSocketSnowflakeStream, Tor } from "@hazae41/echalote";
import { Fleche } from "@hazae41/fleche";
import fallbacks from "assets/fallbacks.json";
import { Arrays } from "libs/arrays/arrays";
import { AsyncEventTarget } from "libs/events/target";
import { Future } from "libs/futures/future";
import { DependencyList, useCallback, useEffect, useMemo, useState } from "react";

async function fetch(socket: WebSocket) {
  const start = Date.now()

  socket.send(JSON.stringify({ "jsonrpc": "2.0", "method": "web3_clientVersion", "params": [], "id": 67 }))

  const event = await new Promise<MessageEvent>((ok, err) => {
    socket.addEventListener("message", ok)
    socket.addEventListener("error", err)
  })

  const delay = Date.now() - start
  console.log(event.data, delay)
}

async function createWebSocket(url: URL, circuit: Circuit, signal?: AbortSignal) {
  const tcp = await circuit.open(url.hostname, 443)
  const tls = new TlsStream(tcp, { ciphers: [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384] })
  const socket = new Fleche.WebSocket(url, undefined, { stream: tls })

  const future = new Future()

  try {
    socket.addEventListener("open", future.ok, { passive: true })
    socket.addEventListener("error", future.err, { passive: true })

    await future.promise
  } finally {
    socket.removeEventListener("open", future.ok)
    socket.removeEventListener("error", future.err)
  }

  return socket
}

async function tryCreateWebSocketLoop(url: URL, circuit: Circuit, signal?: AbortSignal) {
  while (true) {
    try {
      return await createWebSocket(url, circuit, signal)
    } catch (e: unknown) {
      console.warn(e)
      await new Promise(ok => setTimeout(ok, 1000))
    }
  }
}

class SocketPool {

  readonly events = new AsyncEventTarget<{
    promise: MessageEvent<{ index: number, promise: Promise<WebSocket> }>
    socket: MessageEvent<{ index: number, socket: WebSocket }>
  }>()

  readonly #allSockets: WebSocket[]
  readonly #allPromises: Promise<WebSocket>[]

  readonly #openSockets = new Set<WebSocket>()

  constructor(
    readonly url: URL,
    readonly circuits: CircuitPool,
    readonly signal?: AbortSignal
  ) {
    this.#allSockets = new Array(circuits.capacity)
    this.#allPromises = new Array(circuits.capacity)

    for (let index = 0; index < circuits.capacity; index++)
      this.#start(index)
  }

  #start(index: number) {
    if (this.#allSockets.at(index))
      return

    const promise = this.#create(index)
    this.#allPromises[index] = promise
    promise.catch(console.warn)

    const event = new MessageEvent("promise", { data: { index, promise } })
    this.events.dispatchEvent(event, "promise")
  }

  async #create(index: number) {
    const { signal } = this

    const circuit = await this.circuits.get(index)
    const socket = await tryCreateWebSocketLoop(this.url, circuit, signal)

    this.#allSockets[index] = socket
    this.#openSockets.add(socket)

    const onSocketCloseOrError = () => {
      delete this.#allSockets[index]
      this.#openSockets.delete(socket)

      socket.removeEventListener("close", onSocketCloseOrError)
      socket.removeEventListener("error", onSocketCloseOrError)

      this.#start(index)
    }

    socket.addEventListener("close", onSocketCloseOrError)
    socket.addEventListener("error", onSocketCloseOrError)

    const event = new MessageEvent("socket", { data: { index, socket } })
    await this.events.dispatchEvent(event, "socket")

    return socket
  }

  async random() {
    await Promise.any(this.#allPromises)

    return this.randomSync()
  }

  randomSync() {
    const sockets = [...this.#openSockets]
    const socket = Arrays.randomOf(sockets)

    if (!socket)
      throw new Error(`No circuit in pool`)

    return socket
  }

}

function useAsyncMemo<T>(factory: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<T>()

  useEffect(() => {
    factory().then(setState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}

export default function Page() {

  const tor = useAsyncMemo(async () => {
    const tcp = await createWebSocketSnowflakeStream("wss://snowflake.torproject.net/")
    // const tcp = await createWebSocketSnowflakeStream("ws://localhost:12345/")
    // const tcp = await createMeekStream("https://meek.bamsoftware.com/")
    // const tcp = await createWebSocketStream("ws://localhost:8080")

    return new Tor(tcp, { fallbacks })
  }, [])

  const circuits = useMemo(() => {
    if (!tor) return

    return new CircuitPool(tor)
  }, [tor])

  const sockets = useMemo(() => {
    if (!circuits) return

    const url = new URL("wss://mainnet.infura.io/ws/v3/b6bf7d3508c941499b10025c0776eaf8")
    return new SocketPool(url, circuits)
  }, [circuits])

  const socket = useAsyncMemo(async () => {
    if (!sockets) return

    return await sockets.random()
  }, [sockets])

  const onClick = useCallback(async () => {
    if (!sockets) return
    if (!circuits) return

    const socket = await sockets.random()

    await fetch(socket)

    for (const circuit of circuits)
      circuit.destroy()
  }, [sockets, circuits])

  return <>
    <button onClick={onClick}>
      Click me
    </button>
  </>
}