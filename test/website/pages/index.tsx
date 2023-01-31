import { BatchedFetchStream, WebSocketStream } from "@hazae41/cadenas";
import { Circuit, Tor } from "@hazae41/echalote";
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

async function createMeekStream(url: string) {
  const headers = { "x-session-id": crypto.randomUUID() }
  const request = new Request(url, { headers })

  return new BatchedFetchStream(request, { highDelay: 100 })
}

async function createCircuit(tor: Tor) {
  while (true) {
    try {
      const circuit = await tor.create()

      await circuit.extend(false)
      await circuit.extend(true)

      return circuit
    } catch (e: unknown) {
      console.warn("Create failed", e)
    }
  }
}

async function fetchCircuit(circuit: Circuit) {
  const aborter = new AbortController()
  const { signal } = aborter

  setTimeout(() => aborter.abort(), 15 * 1000)

  const body = JSON.stringify({ "jsonrpc": "2.0", "method": "web3_clientVersion", "params": [], "id": 67 })
  const headers = { "content-type": "application/json" }
  const res = await circuit.fetch("https://virginia.rpc.blxrbdn.com", { method: "POST", headers, body, signal })

  // const res = await circuit.fetch("https://twitter.com", {})

  console.log(res)
  console.log(await res.text())
}

async function fetchTor(tor: Tor) {
  while (true)
    try {
      const circuit = await createCircuit(tor)
      await fetchCircuit(circuit)

      return
    } catch (e: unknown) {
      console.warn("Fetch failed", e)
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
    return await createWebSocketStream("ws://localhost:8080")
    // return await createMeekStream("https://meek.bamsoftware.com/")
  }, [])

  const tor = useAsyncMemo(async () => {
    if (!tcp) return

    const tor = new Tor(tcp, { fallbacks })
    await tor.handshake()
    return tor
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