import { Ciphers, TlsStream } from "@hazae41/cadenas";
import { Circuit, CircuitPool, createWebSocketSnowflakeStream, Tor } from "@hazae41/echalote";
import { Fleche } from "@hazae41/fleche";
import fallbacks from "assets/fallbacks.json";
import lorem from "assets/lorem.json";
import { Future } from "libs/futures/future";
import { DependencyList, useCallback, useEffect, useState } from "react";


lorem;

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

async function createWebSocket(circuit: Circuit) {
  const tcp = await circuit.open("mainnet.infura.io", 443)
  const tls = new TlsStream(tcp, { ciphers: [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384] })
  const socket = new Fleche.WebSocket("wss://mainnet.infura.io/ws/v3/b6bf7d3508c941499b10025c0776eaf8", undefined, { stream: tls })

  const future = new Future()

  try {
    socket.addEventListener("open", future.ok)
    socket.addEventListener("error", future.err)

    await future.promise
  } finally {
    socket.removeEventListener("open", future.ok)
    socket.removeEventListener("error", future.err)
  }

  return socket
}

async function raceCreateWebSocket(tor: Tor) {
  const pool = new CircuitPool(tor, {})

  const future = new Future()

  try {
    tor.events.addEventListener("close", future.err)
    tor.events.addEventListener("error", future.err)
    pool.events.addEventListener("circuit", future.ok)

    await future.promise
  } finally {
    tor.events.removeEventListener("close", future.err)
    tor.events.removeEventListener("error", future.err)
    pool.events.removeEventListener("circuit", future.err)
  }

  console.warn("READY")

  const promises = pool.circuits.map(createWebSocket)
  const socket = await Promise.any(promises)

  return socket
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

  const socket = useAsyncMemo(async () => {
    if (!tor) return

    return await raceCreateWebSocket(tor)
  }, [tor])

  const onClick = useCallback(async () => {
    if (!socket) return

    await fetch(socket)
  }, [socket])

  return <>
    <button onClick={onClick}>
      Click me
    </button>
  </>
}