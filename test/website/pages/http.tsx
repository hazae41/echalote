import { Opaque, Writable } from "@hazae41/binary";
import { Disposer } from "@hazae41/disposer";
import { Circuit, Consensus, TorClientDuplex } from "@hazae41/echalote";
import { Ed25519 } from "@hazae41/ed25519";
import { fetch } from "@hazae41/fleche";
import { Mutex } from "@hazae41/mutex";
import { None } from "@hazae41/option";
import { Pool } from "@hazae41/piscine";
import { Ok, Result } from "@hazae41/result";
import { Sha1 } from "@hazae41/sha1";
import { X25519 } from "@hazae41/x25519";
import { createCircuitPool, createStreamPool, createTorPool, tryCreateTor } from "libs/circuits/circuits";
import { DependencyList, useCallback, useEffect, useMemo, useState } from "react";

async function superfetch(stream: ReadableWritablePair<Opaque<Uint8Array>, Writable>) {
  const start = Date.now()

  const body = JSON.stringify({ "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 67 })
  const headers = { "content-type": "application/json" }

  const res = await fetch("https://eth.llamarpc.com", { method: "POST", headers, body, stream, preventClose: true, preventAbort: true, preventCancel: true })

  console.log(await res.text(), `${Date.now() - start}ms`)
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
  circuits: Mutex<Pool<Disposer<Circuit>>>
}

export default function Page() {

  const tors = useAsyncMemo(async () => {
    // const ed25519 = Ed25519.fromNoble(noble_ed25519.ed25519)
    // const x25519 = X25519.fromNoble(noble_ed25519.x25519)
    // const sha1 = Sha1.fromNoble(noble_sha1.sha1)

    Ed25519.set(await Ed25519.fromSafeOrBerith())
    X25519.set(await X25519.fromSafeOrBerith())
    Sha1.set(await Sha1.fromMorax())

    // Echalote.Console.debugging = true
    // Cadenas.Console.debugging = true

    return createTorPool(async () => {
      return await tryCreateTor()
    }, { capacity: 1 })
  }, [])

  const consensus = useAsyncMemo(async () => {
    if (!tors) return

    return await Result.unthrow<Result<Consensus, Error>>(async t => {
      await new Promise(r => setTimeout(r, 1000))
      console.log("Getting Tor...")
      const tor = await tors.inner.getCryptoRandomOrThrow().then(r => r.throw(t).inner.inner)
      console.log("Creating circuit...")
      using circuit = await tor.tryCreate(AbortSignal.timeout(5000)).then(r => r.throw(t))

      console.log("Fetching consensus...")
      const consensus = await Consensus.tryFetch(circuit).then(r => r.throw(t))

      return new Ok(consensus)
    }).then(r => r.unwrap())
  }, [tors])

  const circuits = useMemo(() => {
    if (!tors || !consensus) return

    return createCircuitPool(tors, consensus, { capacity: 9 })
  }, [tors, consensus])

  const streams = useMemo(() => {
    if (!circuits) return

    const url = new URL("https://eth.llamarpc.com")
    return createStreamPool(url, circuits, { capacity: 3 })
  }, [circuits])

  const onClick = useCallback(async () => {
    try {
      if (!streams || streams.locked) return
      if (!circuits || circuits.locked) return

      // const circuit = await circuits.inner.tryGetRandom().then(r => r.unwrap().result.get().inner)
      // const stream = await circuit.openAsOrThrow("https://eth.llamarpc.com")
      const start = Date.now()

      const stream = await streams.inner.tryGetRandom().then(r => r.unwrap().unwrap().inner.inner.inner)

      await stream.lock(async stream => {
        await superfetch(stream)
        // await new Promise(r => setTimeout(r, 100))
      })

      console.log(Date.now() - start)
    } catch (e: unknown) {
      console.error("onClick", { e })
    }
  }, [streams, circuits])

  const [_, setCounter] = useState(0)

  useEffect(() => {
    if (!circuits) return

    const onCreatedOrDeleted = async () => {
      setCounter(c => c + 1)
      return new None()
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