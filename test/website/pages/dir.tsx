import { Cadenas } from "@hazae41/cadenas";
import { Disposer } from "@hazae41/cleaner";
import { Circuit, Echalote, Microdesc, Microdescs, TorClientDuplex } from "@hazae41/echalote";
import { Ed25519 } from "@hazae41/ed25519";
import { tryFetch } from "@hazae41/fleche";
import { Mutex } from "@hazae41/mutex";
import { Pool } from "@hazae41/piscine";
import { Sha1 } from "@hazae41/sha1";
import { X25519 } from "@hazae41/x25519";
import { createTorPool, tryCreateTor } from "libs/circuits/circuits";
import { DependencyList, useCallback, useEffect, useState } from "react";

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

  const params = useAsyncMemo(async () => {
    // const ed25519 = Ed25519.fromNoble(noble_ed25519.ed25519)
    // const x25519 = X25519.fromNoble(noble_ed25519.x25519)
    // const sha1 = Sha1.fromNoble(noble_sha1.sha1)

    Ed25519.set(await Ed25519.fromSafeOrBerith())
    X25519.set(await X25519.fromSafeOrBerith())
    Sha1.set(await Sha1.fromMorax())

    Echalote.Console.debugging = true
    Cadenas.Console.debugging = true

    const fallbacksUrl = "https://raw.githubusercontent.com/hazae41/echalote/master/tools/fallbacks/fallbacks.json"
    const fallbacksRes = await fetch(fallbacksUrl)

    if (!fallbacksRes.ok)
      throw new Error(await fallbacksRes.text())

    const fallbacks = await fallbacksRes.json()

    return { fallbacks }
  }, [])

  const tors = useAsyncMemo(async () => {
    if (!params) return

    return createTorPool(async () => {
      return await tryCreateTor(params)
    }, { capacity: 3 })
  }, [params])

  const [authority, setAuthority] = useState<any>()
  const [circuit, setCircuit] = useState<Circuit>()

  useEffect(() => {
    (async () => {
      if (tors == null)
        return
      const tor = await tors.inner.tryGetCryptoRandom().then(r => r.unwrap().result.get().inner)
      const circuit = await tor.tryCreate().then(r => r.unwrap())

      const authority = await circuit.extendDirOrThrow()

      setCircuit(circuit)
      setAuthority(authority)
    })()
  }, [tors])

  const onClick = useCallback(async () => {
    try {
      if (!circuit) return
      if (!authority) return

      const start = Date.now()

      const stream = await circuit.openDirOrThrow()
      const url = `http://${authority.hosts[0]}/tor/status-vote/current/consensus-microdesc.z`
      const response = await tryFetch(url, { stream: stream.outer }).then(r => r.unwrap())
      console.log(response, Date.now() - start)
      const microdescs = Microdescs.parseOrThrow(await response.text())
      console.log(microdescs, Date.now() - start)

      function* chunks<T>(array: T[], size: number) {
        for (let i = 0; i < array.length; i += size)
          yield array.slice(i, i + size)
      }

      const fasts = microdescs.filter(it => it.flags.includes("Fast"))

      const f = async (chunk: Echalote.Microdescs.Item[]) => {
        for (let i = 0; i < 3; i++) {
          try {
            const start = Date.now()

            const name = chunk.map(m => m.microdesc).join("-")
            const url = `http://${authority.hosts[0]}/tor/micro/d/${name}.z`

            const stream = await circuit.openDirOrThrow()
            const signal = AbortSignal.timeout(5000)

            const response = await tryFetch(url, { stream: stream.outer, signal }).then(r => r.unwrap())
            console.log(response, Date.now() - start)

            const microdesc = Microdesc.parseOrThrow(await response.text())
            console.log(microdesc, Date.now() - start)
          } catch (e: unknown) {
            if (i == 2)
              throw e
            console.error("f", { e })
            continue
          }
        }
      }

      const promises = new Array<Promise<void>>()

      for (const chunk of chunks(fasts, 96)) {
        promises.push(f(chunk))
        // await new Promise(ok => setTimeout(ok, 1000))
      }

      await Promise.all(promises)

      console.log("Done!!!")

    } catch (e: unknown) {
      console.error("onClick", { e })
    }
  }, [circuit, authority])


  return <>
    <button onClick={onClick}>
      Click me
    </button>
  </>
}