import { BatchedFetchStream, WebSocketStream } from "@hazae41/cadenas";
import { Circuit, Tor } from "@hazae41/echalote";
import fallbacks from "assets/fallbacks.json";
import lorem from "assets/lorem.json";
import { DependencyList, useCallback, useEffect, useState } from "react";

lorem;

export function randomOf<T>(array: T[]): T | undefined {
  return array[Math.floor(Math.random() * array.length)]
}

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

  return new BatchedFetchStream(request)
}

async function extendMiddle(circuit: Circuit) {
  // const middle = fallbacks.find(it => it.id = "F50A8F16C555ADFF3E5827B0DD035CE86F71A0E9")!
  const middle = randomOf(fallbacks)!

  const aborter = new AbortController()
  const { signal } = aborter

  setTimeout(() => aborter.abort(), 3000)

  await circuit._extend(middle, signal)
}

async function extendExit(circuit: Circuit) {
  // const exit = fallbacks.find(it => it.id = "68C3B540E5D151461A37CB1ED928563EC3B6CDCB")!
  const exit = randomOf(fallbacks.filter(it => it.exit))!

  const aborter = new AbortController()
  const { signal } = aborter

  setTimeout(() => aborter.abort(), 3000)

  await circuit._extend(exit, signal)
}

async function createCircuit(tor: Tor) {
  while (true)
    try {
      const circuit = await tor.create()

      await extendMiddle(circuit)
      await extendExit(circuit)
      // await circuit.fetch("http://google.com")

      return circuit
    } catch (e: unknown) {
      console.warn("circuit creation failed", e)
    }
}

async function fetch(tor: Tor) {
  const circuit = await createCircuit(tor)

  // const body = JSON.stringify({ "jsonrpc": "2.0", "method": "web3_clientVersion", "params": [], "id": 67 })
  // const headers = { "content-type": "application/json" }

  const res = await circuit.fetch("https://2.tcp.eu.ngrok.io:12979", {})

  console.log(circuit.targets.map(it => it.idHash.toString("hex").toUpperCase()))

  return res
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
    // return await createWebSocketStream("ws://localhost:8080")
    return await createMeekStream("https://meek.bamsoftware.com/")
  }, [])

  const tor = useAsyncMemo(async () => {
    if (!tcp) return

    const tor = new Tor(tcp)
    await tor.handshake()
    return tor
  }, [tcp])

  const onClick = useCallback(async () => {
    if (!tor) return

    try {
      const fetches = new Array<Promise<Response>>()

      for (let i = 0; i < 10; i++)
        fetches.push(fetch(tor))

      const res = await Promise.any(fetches) as Response

      console.log(res)
      console.log(await res.text())
    } catch (e: unknown) {
      console.error("fetch error", e)
    }
  }, [tor])

  return <>
    <button onClick={onClick}>
      Click me
    </button>
  </>
}