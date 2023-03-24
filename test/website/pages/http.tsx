import { Berith } from "@hazae41/berith";
import { Circuit, createCircuitPool, createWebSocketSnowflakeStream, Ed25519, TorClientDuplex, X25519 } from "@hazae41/echalote";
import fallbacks from "assets/fallbacks.json";
import { DependencyList, useCallback, useEffect, useMemo, useState } from "react";

async function fetch(circuit: Circuit) {
  const start = Date.now()

  const body = JSON.stringify({ "jsonrpc": "2.0", "method": "web3_clientVersion", "params": [], "id": 67 })
  const headers = { "content-type": "application/json" }
  const res = await circuit.fetch("https://virginia.rpc.blxrbdn.com", { method: "POST", headers, body })

  // const res = await circuit.fetch("https://twitter.com", {})

  console.log(res, Date.now() - start)
  console.log(await res.text(), Date.now() - start)
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
    // const ed25519 = Ed25519.fromNoble(noble_ed25519.ed25519)
    // const x25519 = X25519.fromNoble(noble_ed25519.x25519)

    await Berith.initBundledOnce()

    const ed25519 = Ed25519.fromBerith(Berith)
    const x25519 = X25519.fromBerith(Berith)

    const tcp = await createWebSocketSnowflakeStream("wss://snowflake.torproject.net/")

    return new TorClientDuplex(tcp, { fallbacks, ed25519, x25519 })
  }, [])

  const circuits = useMemo(() => {
    if (!tor) return

    return createCircuitPool(tor)
  }, [tor])

  const onClick = useCallback(async () => {
    if (!circuits) return

    const circuit = await circuits.random()

    fetch(circuit)
  }, [circuits])

  return <>
    <button onClick={onClick}>
      Click me
    </button>
  </>
}