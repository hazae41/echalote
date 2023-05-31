import { Berith } from "@hazae41/berith";
import { Ed25519 } from "@hazae41/ed25519";
import { Morax } from "@hazae41/morax";
import { Ok } from "@hazae41/result";
import { Sha1 } from "@hazae41/sha1";
import { X25519 } from "@hazae41/x25519";
import { Socket, TorAndCircuitsAndSockets, createTorAndSocketsPool } from "libs/sockets/pool";
import { createTorAndCircuitsPool, createTorPool } from "mods/tor";
import { DependencyList, useCallback, useEffect, useState } from "react";

async function superfetch({ socket, circuit }: Socket) {
  const start = Date.now()

  socket.send(JSON.stringify({ "jsonrpc": "2.0", "method": "web3_clientVersion", "params": [], "id": 67 }))

  const event = await new Promise<MessageEvent>((ok, err) => {
    socket.addEventListener("message", ok)
    socket.addEventListener("error", err)
  })

  console.log(event.data, Date.now() - start)

  socket.close()

  circuit.tryDestroy().then(r => r.unwrap())
}

function useAsyncMemo<T>(factory: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<T>()

  useEffect(() => {
    factory().then(setState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}

export default function Page() {

  const torAndSocketsPool = useAsyncMemo(async () => {
    // const ed25519 = Ed25519.fromNoble(noble_ed25519.ed25519)
    // const x25519 = X25519.fromNoble(noble_ed25519.x25519)
    // const sha1 = Sha1.fromNoble(noble_sha1.sha1)

    await Berith.initBundledOnce()
    await Morax.initBundledOnce()

    const ed25519 = Ed25519.fromBerith(Berith)
    const x25519 = X25519.fromBerith(Berith)
    const sha1 = Sha1.fromMorax(Morax)

    const fallbacksUrl = "https://raw.githubusercontent.com/hazae41/echalote/master/tools/fallbacks/fallbacks.json"
    const fallbacksRes = await fetch(fallbacksUrl)

    if (!fallbacksRes.ok)
      throw new Error(await fallbacksRes.text())

    const fallbacks = await fallbacksRes.json()

    const url = new URL("wss://mainnet.infura.io/ws/v3/b6bf7d3508c941499b10025c0776eaf8")

    const torPool = createTorPool({ fallbacks, ed25519, sha1, x25519, capacity: 3 })
    const torAndCircuitsPool = createTorAndCircuitsPool(torPool, { capacity: 3 })
    const torAndSocketsPool = createTorAndSocketsPool(torAndCircuitsPool, { url })

    return torAndSocketsPool
  }, [])

  const onClick = useCallback(async () => {
    try {
      if (!torAndSocketsPool || torAndSocketsPool.locked) return

      const tor = await torAndSocketsPool.lock(async (tors) => {
        return await tors.tryGetCryptoRandom()
      }).then(r => r.unwrap())

      const socket = await tor.sockets.lock(async (sockets) => {
        const socket = await sockets.tryGetCryptoRandom()
        socket.inspectSync(socket => sockets.delete(socket))
        return socket
      }).then(r => r.unwrap())

      await superfetch(socket)
    } catch (e: unknown) {
      console.error("onClick", { e })
    }
  }, [torAndSocketsPool])

  const [_, setCounter] = useState(0)

  useEffect(() => {
    if (!torAndSocketsPool) return

    const onCreatedOrDeleted = () => {
      setCounter(c => c + 1)
      return Ok.void()
    }

    torAndSocketsPool.inner.events.on("created", onCreatedOrDeleted, { passive: true })
    torAndSocketsPool.inner.events.on("deleted", onCreatedOrDeleted, { passive: true })

    return () => {
      torAndSocketsPool.inner.events.off("created", onCreatedOrDeleted)
      torAndSocketsPool.inner.events.off("deleted", onCreatedOrDeleted)
    }
  }, [torAndSocketsPool])

  return <>
    <button onClick={onClick}>
      Click me
    </button>
    {torAndSocketsPool && [...Array(torAndSocketsPool.inner.capacity)].map((_, i) =>
      <TorDisplay key={i} tor={torAndSocketsPool?.inner.getSync(i)} />)}
  </>
}

function TorDisplay(props: { key: number, tor?: TorAndCircuitsAndSockets }) {
  const { tor } = props

  const [_, setCounter] = useState(0)

  useEffect(() => {
    if (!tor) return

    const onCreatedOrDeleted = () => {
      setCounter(c => c + 1)
      return Ok.void()
    }

    tor.circuits.inner.events.on("created", onCreatedOrDeleted, { passive: true })
    tor.circuits.inner.events.on("deleted", onCreatedOrDeleted, { passive: true })

    tor.sockets.inner.events.on("created", onCreatedOrDeleted, { passive: true })
    tor.sockets.inner.events.on("deleted", onCreatedOrDeleted, { passive: true })

    return () => {
      tor.circuits.inner.events.off("created", onCreatedOrDeleted)
      tor.circuits.inner.events.off("deleted", onCreatedOrDeleted)

      tor.sockets.inner.events.off("created", onCreatedOrDeleted)
      tor.sockets.inner.events.off("deleted", onCreatedOrDeleted)
    }
  }, [tor])

  if (!tor)
    return <div>Loading...</div>

  return <div className="py-1">
    <div>
      Circuit pool size: {tor.circuits.inner.size} / {tor.circuits.inner.capacity}
    </div>
    <div>
      Socket pool size: {tor.sockets.inner.size} / {tor.sockets.inner.capacity}
    </div>
  </div>
}