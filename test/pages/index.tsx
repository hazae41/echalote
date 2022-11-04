import { TlsOverHttp, TlsOverWs, Tor } from "@hazae41/echalote";
import { useCallback, useEffect, useMemo, useState } from "react";
import fallbacks from "../assets/fallbacks.json";

const lorem = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla feugiat, urna vel auctor mollis, est arcu vehicula tortor, sed pharetra est ante at mauris. Nulla vehicula neque et sem placerat, et accumsan nibh bibendum. Curabitur ut elementum risus. Proin varius malesuada elementum. Etiam augue est, gravida nec iaculis a, finibus id purus. Duis id dolor ultricies urna egestas mollis sed nec augue. Nam faucibus, sem ac aliquet pulvinar, nibh nunc sollicitudin justo, posuere molestie tortor lorem non lorem.

Donec dictum non quam in tempor. Nullam rhoncus efficitur sem, vitae fringilla nisl scelerisque ac. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec pellentesque felis et lacus aliquet sollicitudin. Aliquam erat volutpat. Pellentesque velit odio, vehicula sit amet tincidunt nec, imperdiet ac ligula. Mauris magna ante, mattis volutpat ex eu, maximus tincidunt odio. Sed sed nisi auctor, cursus tellus ac, tempus sapien. Phasellus non lobortis est, et consequat tellus. In dignissim sodales rutrum. Quisque hendrerit elementum dolor at tristique. Maecenas posuere ullamcorper sagittis.

Etiam ut lectus sit amet nulla lobortis ultricies. Nullam sed diam leo. Suspendisse finibus posuere eleifend. Curabitur porttitor tincidunt diam, et tempor magna dictum vel. Integer commodo bibendum augue, nec malesuada sapien maximus non. Etiam feugiat erat eget mi tincidunt volutpat. Interdum et malesuada fames ac ante ipsum primis in faucibus. Ut ullamcorper convallis lectus vel porta. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi eget venenatis tellus. In imperdiet turpis ligula, luctus malesuada turpis condimentum eget. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam tempor velit ligula, quis porta dolor porttitor non. Proin eu urna luctus, facilisis purus ut, rhoncus odio. Donec sollicitudin ex eget ligula tristique aliquet.

Morbi ligula diam, auctor a est id, lobortis vehicula turpis. Quisque feugiat lorem vitae sem tristique, ac placerat lorem mattis. Cras ex nisl, euismod eu gravida non, blandit eu nibh. Pellentesque finibus, metus sagittis scelerisque euismod, enim eros congue dolor, aliquam rutrum nunc purus vel risus. Pellentesque gravida sed ligula vel facilisis. Pellentesque porttitor luctus egestas. Aliquam elementum orci a sapien eleifend consequat. Pellentesque id dui non risus eleifend interdum. Suspendisse aliquet cursus viverra. Nunc eu tortor gravida, hendrerit ante a, luctus magna.

Nam tempor condimentum turpis, rutrum accumsan neque sollicitudin sed. Morbi nulla nunc, feugiat ut turpis vel, blandit mattis augue. In aliquam nulla non nulla varius, id aliquam metus volutpat. In magna nibh, luctus id sodales et, scelerisque vitae ligula. Vivamus et euismod sapien. In finibus, dolor at dignissim convallis, quam lectus eleifend enim, non lacinia ex odio eu orci. Nulla aliquet ipsum ut molestie sollicitudin. Nulla in libero a leo gravida accumsan sed sit amet elit. Praesent ac arcu lacus. Nunc malesuada sagittis faucibus.`

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

      // const tls = await http(session)
      const tls = await ws()

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
      await circuit.extend(false)
      await circuit.extend(true)

      console.log("fetching")

      const aborter = new AbortController()
      const { signal } = aborter

      const pres = circuit.fetch("https://postman-echo.com/post?foo1=bar1&foo2=bar2", { signal, method: "POST", body: (lorem + lorem + lorem + lorem + lorem) })

      const res = await pres
      console.log("res")

      await new Promise(ok => setTimeout(ok, 1))
      aborter.abort()

      console.log((await res.text()).length, res.status, res.statusText, [...res.headers.entries()])

      // const res2 = await circuit.fetch("https://postman-echo.com/post?foo1=bar1&foo2=bar2", { method: "POST" })
      // console.log(await res2.text())

      // const res3 = await circuit.fetch("https://postman-echo.com/post?foo1=bar1&foo2=bar2", { method: "POST" })
      // console.log(await res3.text())
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