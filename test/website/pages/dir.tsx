import { Cadenas } from "@hazae41/cadenas";
import { Disposer } from "@hazae41/cleaner";
import { Circuit, Echalote, TorClientDuplex } from "@hazae41/echalote";
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
  const [stream, setStream] = useState<any>()

  useEffect(() => {
    (async () => {
      if (tors == null)
        return
      const tor = await tors.inner.tryGetCryptoRandom().then(r => r.unwrap().result.get().inner)
      const circuit = await tor.tryCreate().then(r => r.unwrap())

      const authority = await circuit.extendDirOrThrow()
      const stream = await circuit.openDirOrThrow()

      setAuthority(authority)
      setStream(stream)
    })()
  }, [tors])

  const onClick = useCallback(async () => {
    try {
      if (!stream) return
      if (!authority) return

      const start = Date.now()
      // const url = `http://${authority.hosts[0]}/tor/micro/d/06+KF9i+hr5r1HOVpmjCXSiyxdVLJlZB/wk6TlXXSjY.z`
      const url = `http://${authority.hosts[0]}/tor/status-vote/current/consensus-microdesc.z`
      const res = await tryFetch(url, { stream: stream.outer, preventAbort: true, preventCancel: true, preventClose: true }).then(r => r.unwrap())

      console.log(res, Date.now() - start)
      console.log(await res.text(), Date.now() - start)
    } catch (e: unknown) {
      console.error("onClick", { e })
    }
  }, [stream, authority])


  return <>
    <button onClick={onClick}>
      Click me
    </button>
  </>
}