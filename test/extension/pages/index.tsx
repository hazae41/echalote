import { TlsOverHttp, TlsOverWs, Tor } from "@hazae41/echalote";
import fallbacks from "assets/fallbacks.json";
import lorem from "assets/lorem.json";
import { useCallback, useEffect, useState } from "react";

lorem;

async function ws() {
  const ws = new WebSocket("ws://localhost:8080")

  await new Promise((ok, err) => {
    ws.addEventListener("open", ok)
    ws.addEventListener("error", err)
  })

  return new TlsOverWs(ws)
}

async function http() {
  const headers = { "x-session-id": crypto.randomUUID() }
  const request = new Request("https://meek.bamsoftware.com/", { headers })

  const tls = new TlsOverHttp(request)
  await tls.open()
  return tls
}

async function createTor() {
  const tls = await http()
  // const tls = await ws()

  const tor = new Tor(tls)
  await tor.init()

  const exits = fallbacks.filter(it => it.exit)
  const middles = fallbacks
  tor.fallbacks = { exits, middles }

  await tor.handshake()
  return tor
}

export default function Page() {
  const [tor, setTor] = useState<Tor>()

  const onClick = useCallback(async () => {
    try {
      if (!tor) return

      const circuit = await tor.create()

      const middle = tor.fallbacks.middles.find(it => it.id === "42A955B09A4E327FBFB46A08F6E21705271CCA12")!
      await circuit._extend(middle)

      const exit = tor.fallbacks.exits.find(it => it.id === "A868303126987902D51F2B6F06DD90038C45B119")!
      await circuit._extend(exit)

      const aborter = new AbortController()
      const { signal } = aborter

      const res = await circuit.fetch("https://webhook.site/feceed4b-3dc6-4db7-bb4e-d1fc281b84f2", { signal, method: "POST", body: "Hello world" })
      console.log(await res.text(), res.status, res.statusText, [...res.headers.entries()])
    } catch (e: unknown) {
      console.error("fetching error", e)
    }
  }, [tor])

  useEffect(() => {
    setTimeout(() => createTor().then(setTor), 100)
  }, [])

  return <>
    <button onClick={onClick}>
      Click me
    </button>
  </>
}