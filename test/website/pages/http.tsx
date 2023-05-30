import { Berith } from "@hazae41/berith";
import { Circuit, TorClientDuplex } from "@hazae41/echalote";
import { Ed25519 } from "@hazae41/ed25519";
import { Morax } from "@hazae41/morax";
import { Mutex } from "@hazae41/mutex";
import { Pool } from "@hazae41/piscine";
import { Ok } from "@hazae41/result";
import { Sha1 } from "@hazae41/sha1";
import { X25519 } from "@hazae41/x25519";
import { createTorAndCircuitsPool, createTorPool } from "mods/tor";
import { DependencyList, useCallback, useEffect, useState } from "react";

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

    const tors = createTorPool({ fallbacks, ed25519, sha1, x25519, capacity: 3 })

    return createTorAndCircuitsPool(tors, { capacity: 3 })
  }, [])

  const onClick = useCallback(async () => {
    try {
      if (!tors || tors.locked) return

      const tor = await tors.lock(async (tors) => {
        return await tors.tryGetCryptoRandom()
      }).then(r => r.unwrap())

      const circuit = await tor.circuits.lock(async (circuits) => {
        const circuit = await circuits.tryGetCryptoRandom()
        circuit.inspectSync(circuit => circuits.delete(circuit))
        return circuit
      }).then(r => r.unwrap())

      await superfetch(circuit)
    } catch (e: unknown) {
      console.error("onClick", { e })
    }
  }, [tors])

  const [_, setCounter] = useState(0)

  useEffect(() => {
    if (!tors) return

    const onCreatedOrDeleted = () => {
      setCounter(c => c + 1)
      return Ok.void()
    }

    tors.inner.events.on("created", onCreatedOrDeleted, { passive: true })
    tors.inner.events.on("deleted", onCreatedOrDeleted, { passive: true })

    return () => {
      tors.inner.events.off("created", onCreatedOrDeleted)
      tors.inner.events.off("deleted", onCreatedOrDeleted)
    }
  }, [tors])

  return <>
    <button onClick={onClick}>
      Click me
    </button>
    {tors && [...Array(tors.inner.capacity)].map((_, i) =>
      <TorDisplay key={i} tor={tors?.inner.getSync(i)} />)}
  </>
}

function TorDisplay(props: { tor?: TorAndCircuits }) {
  const { tor } = props

  const [_, setCounter] = useState(0)

  useEffect(() => {
    if (!tor) return

    const onCreatedOrDeleted = () => {
      setCounter(c => c + 1)
      return Ok.void()
    }

    tor.circuits.inner.events.on("created", onCreatedOrDeleted, { passive: true })
    tor.circuits.inner.events.on("deleted", onCreatedOrDeleted, { passive: true })

    return () => {
      tor.circuits.inner.events.off("created", onCreatedOrDeleted)
      tor.circuits.inner.events.off("deleted", onCreatedOrDeleted)
    }
  }, [tor])

  if (!tor)
    return <div>Loading...</div>

  return <div>
    Circuit pool size: {tor.circuits.inner.size} / {tor.circuits.inner.capacity}
  </div>
}