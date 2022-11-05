import { TlsOverHttp, TlsOverWs, Tor } from "@hazae41/echalote";
import { useCallback, useEffect, useMemo, useState } from "react";
import fallbacks from "../assets/fallbacks.json";

async function ws() {
  const ws = new WebSocket("ws://localhost:8080")

  await new Promise((ok, err) => {
    ws.addEventListener("open", ok)
    ws.addEventListener("error", err)
  })

  return new TlsOverWs(ws)
}

async function http(session: string) {
  const headers = { "x-session-id": session }
  const request = new Request("https://meek.bamsoftware.com/", { headers })

  return new TlsOverHttp(request)
}

export default function Page() {
  const session = useMemo(() => {
    if (typeof window === "undefined")
      return
    return crypto.randomUUID()
  }, [])

  const [tor, setTor] = useState<Tor>()

  const onLoad = useCallback(async () => {
    try {
      if (!session) return

      const tls = await http(session)
      // const tls = await ws()

      const tor = new Tor(tls)
      await tor.init()

      const exits = fallbacks.filter(it => it.exit)
      const middles = fallbacks
      tor.fallbacks = { exits, middles }

      await tor.handshake()
      setTor(tor)
    } catch (e: unknown) {
      console.error(e)
    }
  }, [session])

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

      const pres = circuit.fetch("https://postman-echo.com/post?foo1=bar1&foo2=bar2", { signal, method: "POST", body: "Hello world" })

      aborter.abort()

      const res = await pres

      // await new Promise(ok => setTimeout(ok, 1))
      // aborter.abort()

      console.log(await res.text(), res.status, res.statusText, [...res.headers.entries()])
    } catch (e: unknown) {
      console.error("fetching error", e)
    }
  }, [tor])

  useEffect(() => {
    setTimeout(onLoad, 100)
  }, [onLoad])

  return <>
    <button onClick={onClick}>
      Click me
    </button>
  </>
}