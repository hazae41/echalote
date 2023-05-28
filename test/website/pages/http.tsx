import { Berith } from "@hazae41/berith";
import { Circuit, TorClientDuplex, createCircuitPool, createWebSocketSnowflakeStream } from "@hazae41/echalote";
import { Ed25519 } from "@hazae41/ed25519";
import { Morax } from "@hazae41/morax";
import { Mutex } from "@hazae41/mutex";
import { Pool } from "@hazae41/piscine";
import { Ok } from "@hazae41/result";
import { Sha1 } from "@hazae41/sha1";
import { X25519 } from "@hazae41/x25519";
import { DependencyList, useCallback, useEffect, useMemo, useState } from "react";

async function superfetch(circuit: Circuit) {
  const start = Date.now()

  const body = JSON.stringify({ "jsonrpc": "2.0", "method": "web3_clientVersion", "params": [], "id": 67 })
  const headers = { "content-type": "application/json" }
  const res = await circuit.tryFetch("https://virginia.rpc.blxrbdn.com", { method: "POST", headers, body }).then(r => r.unwrap())

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

  const tors = useAsyncMemo(async () => {
    // const ed25519 = Ed25519.fromNoble(noble_ed25519.ed25519)
    // const x25519 = X25519.fromNoble(noble_ed25519.x25519)
    // const sha1 = Sha1.fromNoble(noble_sha1.sha1)

    await Berith.initBundledOnce()
    await Morax.initBundledOnce()

    const ed25519 = Ed25519.fromBerith(Berith)
    const x25519 = X25519.fromBerith(Berith)
    const sha1 = Sha1.fromMorax(Morax)

    const fallbacksUrl = "https://raw.githubusercontent.com/hazae41/echalote/master/tools/fallbacks/fallbacks.json"
    const fallbacksRes = await fetch(fallbacksUrl)

    if (!fallbacksRes.ok)
      throw new Error(await fallbacksRes.text())

    const fallbacks = await fallbacksRes.json()

    return new Pool<TorClientDuplex>(async ({ pool }) => {
      const tcp = await createWebSocketSnowflakeStream("wss://snowflake.torproject.net/")

      const tor = new TorClientDuplex(tcp, { fallbacks, ed25519, x25519, sha1 })

      const onCloseOrError = async (reason?: unknown) => {
        tor.events.off("close", onCloseOrError)
        tor.events.off("error", onCloseOrError)

        await pool.delete(tor)

        return Ok.void()
      }

      tor.events.on("close", onCloseOrError, { passive: true })
      tor.events.on("error", onCloseOrError, { passive: true })

      return tor
    }, { capacity: 1 })
  }, [])

  const [tor, setTor] = useState<TorClientDuplex>()

  useEffect(() => {
    return tors?.events.on("created", tor => {
      return new Ok(setTor(tor.element))
    }, { passive: true })
  }, [tors])

  useEffect(() => {
    return tors?.events.on("deleted", () => {
      return new Ok(setTor(undefined))
    }, { passive: true })
  }, [tors])

  const circuits = useMemo(() => {
    if (!tor) return

    return new Mutex(createCircuitPool(tor, { capacity: 10 }))
  }, [tor])

  const onClick = useCallback(async () => {
    try {
      if (!circuits || circuits.locked) return

      const circuit = await circuits.lock(async (circuits) => {
        const circuit = await circuits.cryptoRandom()
        circuits.delete(circuit)
        return circuit
      })

      await superfetch(circuit)
    } catch (e: unknown) {
      console.error("onClick", { e })
    }
  }, [circuits])

  const [_, setCounter] = useState(0)

  useEffect(() => {
    if (!circuits) return

    const onCreatedOrDeleted = () => {
      setCounter(c => c + 1)
      return Ok.void()
    }

    circuits.inner.events.on("created", onCreatedOrDeleted, { passive: true })
    circuits.inner.events.on("deleted", onCreatedOrDeleted, { passive: true })

    return () => {
      circuits.inner.events.off("created", onCreatedOrDeleted)
      circuits.inner.events.off("deleted", onCreatedOrDeleted)
    }
  }, [circuits])

  return <>
    <button onClick={onClick}>
      Click me
    </button>
    {circuits &&
      <div>
        Circuit pool size: {circuits.inner.size} / {circuits.inner.capacity}
      </div>}
  </>
}