import { Ciphers, TlsStream } from "@hazae41/cadenas";
import { Circuit, createWebSocketSnowflakeStream, Tor } from "@hazae41/echalote";
import { Fleche } from "@hazae41/fleche";
import fallbacks from "assets/fallbacks.json";
import lorem from "assets/lorem.json";
import { DependencyList, useCallback, useEffect, useState } from "react";

lorem;

async function fetchWs(ws: Fleche.WebSocket) {
  const start = Date.now()

  ws.send(JSON.stringify({ "jsonrpc": "2.0", "method": "web3_clientVersion", "params": [], "id": 67 }))

  const event = await new Promise<MessageEvent>((ok, err) => {
    ws.addEventListener("message", ok)
    ws.addEventListener("error", err)
  })

  const delay = Date.now() - start
  console.log(event.data, delay)
}

async function fetchCircuit(circuit: Circuit) {
  // const body = JSON.stringify({ "jsonrpc": "2.0", "method": "web3_clientVersion", "params": [], "id": 67 })
  // const headers = { "content-type": "application/json" }
  // const res = await circuit.fetch("https://virginia.rpc.blxrbdn.com", { method: "POST", headers, body, signal })

  // const res = await circuit.fetch("https://twitter.com", {})

  // console.log(res)
  // console.log(await res.text())

  const tcp = await circuit.open("mainnet.infura.io", 443)
  const tls = new TlsStream(tcp, { ciphers: [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384] })
  const ws = new Fleche.WebSocket("wss://mainnet.infura.io/ws/v3/b6bf7d3508c941499b10025c0776eaf8", undefined, { stream: tls })

  await new Promise((ok, err) => {
    ws.addEventListener("open", ok)
    ws.addEventListener("error", err)
  })

  return ws
}

async function fetchTor(tor: Tor) {
  while (true)
    try {
      const circuit = await tor.tryCreateAndExtend()
      return await fetchCircuit(circuit)
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

  const tor = useAsyncMemo(async () => {
    const tcp = await createWebSocketSnowflakeStream("wss://snowflake.torproject.net/")
    // const tcp = await createWebSocketSnowflakeStream("ws://localhost:12345/")
    // const tcp = await createMeekStream("https://meek.bamsoftware.com/")
    // const tcp = await createWebSocketStream("ws://localhost:8080")

    return new Tor(tcp, { fallbacks })
  }, [])

  const ws = useAsyncMemo(async () => {
    if (!tor) return

    return await fetchTor(tor)
  }, [tor])

  const onClick = useCallback(async () => {
    if (!ws) return

    for (let i = 0; i < 10; i++)
      fetchWs(ws)
  }, [ws])

  return <>
    <button onClick={onClick}>
      Click me
    </button>
  </>
}