import { Ciphers, TlsStream, WebSocketStream } from "@hazae41/cadenas";
import { Circuit, createWebSocketTurboStream, Tor } from "@hazae41/echalote";
import { Fleche } from "@hazae41/fleche";
import fallbacks from "assets/fallbacks.json";
import lorem from "assets/lorem.json";
import { DependencyList, useCallback, useEffect, useState } from "react";

lorem;

async function createWebSocketStream(url: string) {
  const websocket = new WebSocket(url)

  websocket.binaryType = "arraybuffer"

  await new Promise((ok, err) => {
    websocket.addEventListener("open", ok)
    websocket.addEventListener("error", err)
  })

  return new WebSocketStream(websocket)
}

async function createCircuit(tor: Tor) {
  while (true)
    try {
      const circuit = await tor.create()

      await circuit.extend(false)
      await circuit.extend(true)

      return circuit
    } catch (e: unknown) {
      console.warn("Create failed", e)
      await new Promise(ok => setTimeout(ok, 1000))
    }
}

async function fetchCircuit(circuit: Circuit) {
  const aborter = new AbortController()
  const { signal } = aborter

  setTimeout(() => aborter.abort(), 15 * 1000)

  const body = JSON.stringify({ "jsonrpc": "2.0", "method": "web3_clientVersion", "params": [], "id": 67 })
  // const headers = { "content-type": "application/json" }
  // const res = await circuit.fetch("https://virginia.rpc.blxrbdn.com", { method: "POST", headers, body, signal })

  // // const res = await circuit.fetch("https://twitter.com", {})

  // console.log(res)
  // console.log(await res.text())

  const tcp = await circuit.open("mainnet.infura.io", 443)
  const tls = new TlsStream(tcp, { ciphers: [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384] })
  await tls.handshake()
  const ws = new Fleche.WebSocket("wss://mainnet.infura.io/ws/v3/b6bf7d3508c941499b10025c0776eaf8", undefined, { stream: tls })

  await new Promise((ok, err) => {
    ws.addEventListener("open", ok)
    ws.addEventListener("error", err)
  })

  ws.send(JSON.stringify({ "jsonrpc": "2.0", "method": "web3_clientVersion", "params": [], "id": 67 }))

  const event = await new Promise((ok, err) => {
    ws.addEventListener("message", ok)
    ws.addEventListener("error", err)
  })

  const msgEvent = event as MessageEvent
  console.log(msgEvent.data)
}

async function fetchTor(tor: Tor) {
  while (true)
    try {
      const circuit = await createCircuit(tor)
      await fetchCircuit(circuit)

      return
    } catch (e: unknown) {
      console.warn("Fetch failed", e)
      await new Promise(ok => setTimeout(ok, 1000))
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
  const tcp = useAsyncMemo(async () => {
    return await createWebSocketTurboStream("wss://snowflake.bamsoftware.com/")
    // return await createMeekStream("https://meek.bamsoftware.com/")
  }, [])

  const tor = useAsyncMemo(async () => {
    try {
      if (!tcp) return

      const tor = new Tor(tcp, { fallbacks })
      await tor.handshake()
      return tor
    } catch (e: unknown) {
      console.error("Tor", e)
    }
  }, [tcp])

  const onClick = useCallback(async () => {
    if (!tor) return

    await fetchTor(tor)
  }, [tor])

  return <>
    <button onClick={onClick}>
      Click me
    </button>
  </>
}