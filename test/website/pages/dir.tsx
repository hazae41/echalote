import { Ciphers, TlsClientDuplex } from "@hazae41/cadenas";
import { Disposer } from "@hazae41/cleaner";
import { Circuit, Consensus, Echalote, TorClientDuplex } from "@hazae41/echalote";
import { Ed25519 } from "@hazae41/ed25519";
import { fetch } from "@hazae41/fleche";
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

async function openAsOrThrow(circuit: Circuit, input: RequestInfo | URL) {
  const req = new Request(input)
  const url = new URL(req.url)

  if (url.protocol === "http:") {
    const tcp = await circuit.openOrThrow(url.hostname, Number(url.port) || 80)

    return tcp.outer
  }

  if (url.protocol === "https:") {
    const tcp = await circuit.openOrThrow(url.hostname, Number(url.port) || 443)

    const ciphers = [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384]
    const tls = new TlsClientDuplex({ host_name: url.hostname, ciphers })

    tcp.outer.readable.pipeTo(tls.inner.writable).catch(() => { })
    tls.inner.readable.pipeTo(tcp.outer.writable).catch(() => { })

    return tls.outer
  }

  throw new Error(url.protocol)
}

export interface TorAndCircuits {
  tor: TorClientDuplex
  circuits: Mutex<Pool<Disposer<Circuit>>>
}

export default function Page() {

  const [stream, setStream] = useState<ReadableWritablePair<any, any>>()

  useEffect(() => {
    (async () => {
      Ed25519.set(await Ed25519.fromSafeOrBerith())
      X25519.set(await X25519.fromSafeOrBerith())
      Sha1.set(await Sha1.fromMorax())

      Echalote.Console.debugging = true
      // Cadenas.Console.debugging = true

      const tor = await tryCreateTor({}).then(r => r.unwrap())
      const circuit = await tor.tryCreate().then(r => r.unwrap())

      const consensus = await Consensus.fetchOrThrow(circuit)

      console.log(consensus)

      const seconds = consensus.microdescs.filter(it => true
        && it.flags.includes("Fast")
        && it.flags.includes("Stable")
        && it.flags.includes("V2Dir"))

      const thirds = consensus.microdescs.filter(it => true
        && it.flags.includes("Fast")
        && it.flags.includes("Stable")
        && it.flags.includes("Exit")
        && !it.flags.includes("BadExit"))

      console.log(seconds.length, thirds.length)

      const second = await circuit.unrefOrThrow(seconds[Math.floor(Math.random() * seconds.length)])
      await circuit.extendToOrThrow(second)

      const third = await circuit.unrefOrThrow(thirds[Math.floor(Math.random() * thirds.length)])
      await circuit.extendToOrThrow(third)

      const stream = await openAsOrThrow(circuit, `https://eth.llamarpc.com`)

      setStream(stream)
    })().catch(e => console.error({ e }))
  }, [])

  const onClick = useCallback(async () => {
    try {
      if (!stream) return

      const start = Date.now()

      const body = JSON.stringify({ "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 67 })
      const headers = { "content-type": "application/json" }

      const response = await fetch(`https://eth.llamarpc.com`, { stream, method: "POST", headers, body, preventClose: true, preventAbort: true, preventCancel: true })
      console.log(response, Date.now() - start)

      const data = await response.text()
      console.log(data, Date.now() - start)

      console.log("Done!!!", Date.now() - start)
    } catch (e: unknown) {
      console.error("onClick", { e })
    }
  }, [stream])

  return <>
    <button onClick={onClick}>
      Click me
    </button>
  </>
}