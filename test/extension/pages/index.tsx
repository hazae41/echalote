import { Circuit, TlsOverHttp, TlsOverWs, Tor } from "@hazae41/echalote";
import fallbacks from "assets/fallbacks.json";
import lorem from "assets/lorem.json";
import { useCallback, useEffect, useState } from "react";

lorem;

export function randomOf<T>(array: T[]): T | undefined {
  return array[Math.floor(Math.random() * array.length)]
}

async function createTlsOverWs() {
  const ws = new WebSocket("ws://localhost:8080")

  await new Promise((ok, err) => {
    ws.addEventListener("open", ok)
    ws.addEventListener("error", err)
  })

  const tls = new TlsOverWs(ws)
  await tls.open()
  return tls
}

async function createTlsOverHttp() {
  while (true)
    try {
      const headers = new Headers({ "x-session-id": crypto.randomUUID() })
      const request = new Request("https://meek.bamsoftware.com/", { headers })

      const tls = new TlsOverHttp(request)
      await tls.open()
      return tls
    } catch (e: unknown) {
      console.warn(e)
    }
}

async function createTor() {
  const tls = await createTlsOverHttp()

  while (true)
    try {
      const tor = new Tor(tls)
      await tor.init()
      await tor.handshake()
      return tor
    } catch (e: unknown) {
      console.warn(e)
    }
}

async function extendMiddle(circuit: Circuit) {
  while (true)
    try {
      // const middleid = randomOf(middles)!
      // const middle = fallbacks.find(it => it.id === middleid)!

      const middle = randomOf(fallbacks)!

      console.log("middle", middle.id)
      await circuit._extend(middle)
      return
    } catch (e: unknown) {
      console.warn(e)
    }
}

async function extendExit(circuit: Circuit) {
  while (true)
    try {
      // const exitid = randomOf(exits)!
      // const exit = fallbacks.find(it => it.id === exitid)!

      const exit = randomOf(fallbacks.filter(it => it.exit))!

      console.log("exit", exit.id)
      await circuit._extend(exit)
      return
    } catch (e: unknown) {
      console.warn(e)
    }
}

async function createCircuit(tor: Tor) {
  while (true)
    try {
      console.log("creating")
      const circuit = await tor.create()
      await extendMiddle(circuit)
      await extendExit(circuit)
      await circuit.fetch("http://google.com")
      return circuit
    } catch (e: unknown) {
      console.warn(e)
    }
}

export default function Page() {
  const [tor, setTor] = useState<Tor>()

  const onClick = useCallback(async () => {
    try {
      if (!tor) return

      const circuit = await createCircuit(tor)

      const aborter = new AbortController()
      const { signal } = aborter

      const body = JSON.stringify({ hello: "world", it: "works", very: "fine" })
      const headers = new Headers({ "Content-Type": "application/json" })
      const res = await circuit.fetch("http://postman-echo.com/post", { signal, method: "POST", body, headers })
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