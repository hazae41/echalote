import { Berith } from "@hazae41/berith";
import { Circuit, TorClientDuplex, createCircuitPoolFromTorPool } from "@hazae41/echalote";
import { Ed25519 } from "@hazae41/ed25519";
import { Morax } from "@hazae41/morax";
import { Mutex } from "@hazae41/mutex";
import { Pool } from "@hazae41/piscine";
import { Ok } from "@hazae41/result";
import { Sha1 } from "@hazae41/sha1";
import { X25519 } from "@hazae41/x25519";
import { createTorPool } from "mods/tor";
import { DependencyList, useCallback, useEffect, useMemo, useState } from "react";

async function superfetch(circuit: Circuit) {
  const start = Date.now()

  const body = JSON.stringify({ "jsonrpc": "2.0", "method": "web3_clientVersion", "params": [], "id": 67 })
  const headers = { "content-type": "application/json" }
  const res = await circuit.tryFetch("https://virginia.rpc.blxrbdn.com", { method: "POST", headers, body }).then(r => r.unwrap())

  // const res = await circuit.fetch("https://twitter.com", {})

  console.log(res, Date.now() - start)
  console.log(await res.text(), Date.now() - start)

  circuit.tryDestroy().then(r => r.unwrap())
}

function useAsyncMemo<T>(factory: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<T>()

  useEffect(() => {
    factory().then(setState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}

export interface TorAndCircuits {
  tor: TorClientDuplex
  circuits: Mutex<Pool<Circuit>>
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

    return createTorPool({ fallbacks, ed25519, sha1, x25519, capacity: 3 })
  }, [])

  const circuits = useMemo(() => {
    if (!tors) return

    return createCircuitPoolFromTorPool(tors, { capacity: 9 })
  }, [tors])

  const onClick = useCallback(async () => {
    try {
      if (!circuits || circuits.locked) return

      const circuit = await Pool
        .takeCryptoRandom(circuits)
        .then(r => r.unwrap())

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
    {circuits
      ? <div>
        Circuit pool size: {circuits.inner.size} / {circuits.inner.capacity}
      </div>
      : <div>
        Loading...
      </div>}
  </>
}