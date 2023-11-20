import { Cadenas } from "@hazae41/cadenas";
import { Disposer } from "@hazae41/cleaner";
import { Authorities, Circuit, Echalote, Fallback, Microdesc, Microdescs, TorClientDuplex } from "@hazae41/echalote";
import { Ed25519 } from "@hazae41/ed25519";
import { tryFetch } from "@hazae41/fleche";
import { Mutex } from "@hazae41/mutex";
import { Pool } from "@hazae41/piscine";
import { Sha1 } from "@hazae41/sha1";
import { X25519 } from "@hazae41/x25519";
import { tryCreateTor } from "libs/circuits/circuits";
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

  const [tor, setTor] = useState<TorClientDuplex>()
  const [authority, setAuthority] = useState<any>()
  const [circuit, setCircuit] = useState<Circuit>()

  useEffect(() => {
    if (!params) return

    (async () => {
      const tor = await tryCreateTor(params).then(r => r.unwrap())
      const circuit = await tor.tryCreate().then(r => r.unwrap())

      const authority = { "id": "7EA6EAD6FD83083C538F44038BBFA077587DD755", "eid": "g/2ajydWM/x16QePc6QXMVcVsaftXbmH4dZUozDhl5E", "exit": false, "onion": [9, 138, 203, 5, 62, 176, 241, 118, 192, 6, 190, 106, 84, 251, 145, 152, 157, 121, 189, 229, 110, 18, 41, 43, 19, 52, 251, 106, 175, 230, 63, 8], "hosts": ["45.66.35.11:443"] }
      await circuit.extendToOrThrow(authority)

      setTor(tor)
      setCircuit(circuit)
      setAuthority(authority)
    })()
  }, [params])

  const onClick = useCallback(async () => {
    try {
      if (!params) return
      if (!circuit) return
      if (!authority) return
      if (!tor) return

      const start = Date.now()

      const stream = await circuit.openDirOrThrow()
      const url = `http://${authority.hosts[0]}/tor/status-vote/current/consensus-microdesc.z`
      const response = await tryFetch(url, { stream: stream.outer }).then(r => r.unwrap())
      console.log(response, Date.now() - start)
      const microdescs = Microdescs.parseOrThrow(await response.text())
      console.log(microdescs, Date.now() - start)

      function* chunkify<T>(array: T[], size: number) {
        for (let i = 0; i < array.length; i += size)
          yield array.slice(i, i + size)
      }

      const fasts = microdescs.filter(it => it.flags.includes("Fast"))

      const f = async (circuit: Circuit, chunk: Echalote.Microdescs.Item[]) => {
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

            break
          } catch (e: unknown) {
            if (i == 2)
              throw e
            console.warn("f", { e })
            await new Promise(ok => setTimeout(ok, 1000))
            continue
          }
        }
      }

      const chunks = chunkify(fasts, 96)

      const g = async (authority: Fallback) => {
        try {
          const tor = await tryCreateTor(params).then(r => r.unwrap())
          const circuit = await tor.tryCreate().then(r => r.unwrap())
          await circuit.extendToOrThrow(authority, AbortSignal.timeout(5000))

          for (const chunk of chunks)
            await f(circuit, chunk)
        } catch (e: unknown) {
          console.log("g", { e, authority })
          throw e
        }
      }

      const promises = new Array<Promise<void>>()

      for (let i = 0; i < Authorities.fallbacks.length; i++) {
        const authority = Authorities.fallbacks[i]
        if (authority.id === "BD6A829255CB08E66FBE7D3748363586E46B3810")
          continue
        promises.push(g(authority))
      }

      await Promise.all(promises)

      console.log("Done!!!", Date.now() - start)

    } catch (e: unknown) {
      console.error("onClick", { e })
    }
  }, [tor, circuit, authority])


  return <>
    <button onClick={onClick}>
      Click me
    </button>
  </>
}