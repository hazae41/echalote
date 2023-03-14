import { createCircuitPool, createWebSocketSnowflakeStream, TorClientDuplex } from "@hazae41/echalote";
import fallbacks from "assets/fallbacks.json";
import { SocketPool } from "libs/sockets/pool";
import { DependencyList, useCallback, useEffect, useMemo, useState } from "react";

async function fetch(socket: WebSocket) {
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
    const tcp = await createWebSocketSnowflakeStream("wss://snowflake.torproject.net/")
    // const tcp = await createWebSocketSnowflakeStream("ws://localhost:12345/")
    // const tcp = await createMeekStream("https://meek.bamsoftware.com/")
    // const tcp = await createWebSocketStream("ws://localhost:8080")

    return new TorClientDuplex(tcp, { fallbacks })
  }, [])

  const circuits = useMemo(() => {
    if (!tor) return

    return createCircuitPool(tor)
  }, [tor])

  const sockets = useMemo(() => {
    if (!circuits) return

    const url = new URL("wss://mainnet.infura.io/ws/v3/b6bf7d3508c941499b10025c0776eaf8")

    return new SocketPool(url, circuits)
  }, [circuits])

  const onClick = useCallback(async () => {
    if (!sockets) return

    const socket = await sockets.random()

    await fetch(socket)
  }, [sockets])

  return <>
    <button onClick={onClick}>
      Click me
    </button>
  </>
}