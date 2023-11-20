import { Disposer } from "@hazae41/cleaner";
import { Circuit, Echalote, Fallback, Microdesc, Microdescs, TorClientDuplex } from "@hazae41/echalote";
import { Ed25519 } from "@hazae41/ed25519";
import { tryFetch } from "@hazae41/fleche";
import { Mutex } from "@hazae41/mutex";
import { Pool } from "@hazae41/piscine";
import { Sha1 } from "@hazae41/sha1";
import { X25519 } from "@hazae41/x25519";
import { createTorPool2, tryCreateTor } from "libs/circuits/circuits";
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
    Ed25519.set(await Ed25519.fromSafeOrBerith())
    X25519.set(await X25519.fromSafeOrBerith())
    Sha1.set(await Sha1.fromMorax())

    Echalote.Console.debugging = true
    // Cadenas.Console.debugging = true
  }, [])

  const tors = useAsyncMemo(async () => {
    return createTorPool2({ fallbacks: [], capacity: 3 })
  }, [])

  const onClick = useCallback(async () => {
    try {
      if (!tors) return

      const start = Date.now()

      const tor = await tryCreateTor({ fallbacks: [] }).then(r => r.unwrap())
      const circuit = await tor.tryCreate().then(r => r.unwrap())

      const stream = await circuit.openDirOrThrow()
      const url = `http://localhost/tor/status-vote/current/consensus-microdesc.z`

      const response = await tryFetch(url, { stream: stream.outer }).then(r => r.unwrap())
      console.log(response, Date.now() - start)

      const microrefs = Microdescs.parseOrThrow(await response.text())
      console.log(microrefs, Date.now() - start)

      const fasts = microrefs.filter(it => true
        && it.flags.includes("Fast")
        && it.flags.includes("Stable"))

      async function unref(ref: Microdescs.Item) {
        const start = Date.now()

        const stream = await circuit.openDirOrThrow()
        const url = `http://localhost/tor/micro/d/${ref.microdesc}.z`

        const response = await tryFetch(url, { stream: stream.outer }).then(r => r.unwrap())
        console.log(response, Date.now() - start)

        const desc = Microdesc.parseOrThrow(await response.text())
        console.log(desc, Date.now() - start)

        return desc[0]
      }

      {
        const start = Date.now()

        for (let i = 0; i < 2; i++) {
          const ref = fasts[Math.floor(Math.random() * fasts.length)]
          const desc = await unref(ref)
          console.log(ref, desc)

          const fb: Fallback = {
            id: Buffer.from(ref.identity, "base64").toString("hex"),
            onion: Buffer.from(desc.ntorOnionKey, "base64").toJSON().data,
            hosts: [`${ref.hostname}:${ref.orport}`],
            eid: desc.idEd25519
          }

          await circuit.extendToOrThrow(fb)
        }

        const url = `https://twitter.com`
        const stream = await circuit.openAsOrThrow(url)

        const response = await tryFetch(url, { stream }).then(r => r.unwrap())
        console.log(response, Date.now() - start)

        const data = await response.text()
        console.log(data, Date.now() - start)
      }

      console.log("Done!!!", Date.now() - start)
    } catch (e: unknown) {
      console.error("onClick", { e })
    }
  }, [tors])


  return <>
    <button onClick={onClick}>
      Click me
    </button>
  </>
}