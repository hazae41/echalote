import { Berith } from "@hazae41/berith";
import { createCircuitPool, createWebSocketSnowflakeStream, TorClientDuplex } from "@hazae41/echalote";
import { Ed25519 } from "@hazae41/ed25519";
import { Morax } from "@hazae41/morax";
import { Mutex } from "@hazae41/mutex";
import { Sha1 } from "@hazae41/sha1";
import { X25519 } from "@hazae41/x25519";
import { createWebSocketPool } from "libs/sockets/pool";
import { DependencyList, useCallback, useEffect, useMemo, useRef, useState } from "react";

async function superfetch(socket: WebSocket) {
  const start = Date.now()

  socket.send(JSON.stringify({ "jsonrpc": "2.0", "method": "web3_clientVersion", "params": [], "id": 67 }))

  const event = await new Promise<MessageEvent>((ok, err) => {
    socket.addEventListener("message", ok)
    socket.addEventListener("error", err)
  })

  console.log(event.data, Date.now() - start)
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
    await Berith.initBundledOnce()
    await Morax.initBundledOnce()

    const ed25519 = Ed25519.fromBerith(Berith)
    const x25519 = X25519.fromBerith(Berith)
    const sha1 = Sha1.fromMorax(Morax)

    const fallbacksUrl = "https://raw.githubusercontent.com/hazae41/echalote/master/tools/fallbacks/fallbacks.json"
    const fallbacksRes = await fetch(fallbacksUrl)
    if (!fallbacksRes.ok) throw new Error(await fallbacksRes.text())
    const fallbacks = await fallbacksRes.json()

    const tcp = await createWebSocketSnowflakeStream("wss://snowflake.torproject.net/")
    // const tcp = await createWebSocketSnowflakeStream("ws://localhost:12345/")
    // const tcp = await createMeekStream("https://meek.bamsoftware.com/")
    // const tcp = await createWebSocketStream("ws://localhost:8080")

    return new TorClientDuplex(tcp, { fallbacks, ed25519, x25519, sha1 })
  }, [])

  const circuits = useMemo(() => {
    if (!tor) return

    return createCircuitPool(tor, { capacity: 10 })
  }, [tor])

  const sockets = useMemo(() => {
    if (!circuits) return

    const url = new URL("wss://mainnet.infura.io/ws/v3/b6bf7d3508c941499b10025c0776eaf8")

    return createWebSocketPool(url, circuits, { capacity: 10 })
  }, [circuits])

  const mutex = useRef(new Mutex())

  const onClick = useCallback(async () => {
    if (!sockets) return

    if (mutex.current.promise) return

    const socket = await mutex.current.lock(async () => {
      const socket = await sockets.cryptoRandom()
      sockets.delete(socket)
      return socket
    })

    await superfetch(socket)
  }, [sockets])

  const [_, setCounter] = useState(0)

  useEffect(() => {
    if (!circuits) return
    if (!sockets) return

    const onCreatedOrDeleted = () => {
      setCounter(c => c + 1)
    }

    circuits.events.addEventListener("created", onCreatedOrDeleted, { passive: true })
    circuits.events.addEventListener("deleted", onCreatedOrDeleted, { passive: true })

    sockets.events.addEventListener("created", onCreatedOrDeleted, { passive: true })
    sockets.events.addEventListener("deleted", onCreatedOrDeleted, { passive: true })

    return () => {
      circuits.events.removeEventListener("created", onCreatedOrDeleted)
      circuits.events.removeEventListener("deleted", onCreatedOrDeleted)

      sockets.events.removeEventListener("created", onCreatedOrDeleted)
      sockets.events.removeEventListener("deleted", onCreatedOrDeleted)
    }
  }, [circuits, sockets])

  return <>
    <button onClick={onClick}>
      Click me
    </button>
    {circuits &&
      <div>
        Circuit pool size: {circuits.size} / {circuits.capacity}
      </div>}
    {sockets &&
      <div>
        Socket pool size: {sockets.size} / {sockets.capacity}
      </div>}
  </>
}