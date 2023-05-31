import { Berith } from "@hazae41/berith";
import { createCircuitPoolFromTorPool } from "@hazae41/echalote";
import { Ed25519 } from "@hazae41/ed25519";
import { Morax } from "@hazae41/morax";
import { Pool } from "@hazae41/piscine";
import { Ok } from "@hazae41/result";
import { Sha1 } from "@hazae41/sha1";
import { X25519 } from "@hazae41/x25519";
import { Session, createSessionFromCircuitPool } from "libs/sockets/pool";
import { createTorPool } from "mods/tor";
import { DependencyList, useCallback, useEffect, useMemo, useState } from "react";

async function superfetch(session: Session) {
  const { sockets, circuit } = session

  const socket = await sockets.inner.tryGet(0).then(r => r.unwrap())

  const start = Date.now()

  socket.send(JSON.stringify({ "jsonrpc": "2.0", "method": "web3_clientVersion", "params": [], "id": 67 }))

  const event = await new Promise<MessageEvent>((ok, err) => {
    socket.addEventListener("message", ok)
    socket.addEventListener("error", err)
  })

  console.log(event.data, Date.now() - start)

  socket.close()

  await circuit.tryDestroy().then(r => r.unwrap())
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

  const tors = useAsyncMemo(async () => {
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

    return createTorPool({ fallbacks, ed25519, sha1, x25519, capacity: 3 })
  }, [])

  const circuits = useMemo(() => {
    if (!tors) return

    return createCircuitPoolFromTorPool(tors, { capacity: 9 })
  }, [tors])

  const sessions = useMemo(() => {
    if (!circuits) return

    return createSessionFromCircuitPool(circuits, { capacity: 9 })
  }, [circuits])

  const onClick = useCallback(async () => {
    try {
      if (!sessions || sessions.locked) return

      const session = await Pool
        .takeCryptoRandom(sessions)
        .then(r => r.unwrap())

      console.log(sessions.inner.size)

      await superfetch(session)
    } catch (e: unknown) {
      console.error("onClick", { e })
    }
  }, [sessions])

  const [_, setCounter] = useState(0)

  useEffect(() => {
    if (!circuits || !sessions) return

    const onCreatedOrDeleted = () => {
      setCounter(c => c + 1)
      return Ok.void()
    }

    circuits.inner.events.on("created", onCreatedOrDeleted, { passive: true })
    circuits.inner.events.on("deleted", onCreatedOrDeleted, { passive: true })

    sessions.inner.events.on("created", onCreatedOrDeleted, { passive: true })
    sessions.inner.events.on("deleted", onCreatedOrDeleted, { passive: true })

    return () => {
      circuits.inner.events.off("created", onCreatedOrDeleted)
      circuits.inner.events.off("deleted", onCreatedOrDeleted)

      sessions.inner.events.off("created", onCreatedOrDeleted)
      sessions.inner.events.off("deleted", onCreatedOrDeleted)
    }
  }, [circuits, sessions])

  return <>
    <button onClick={onClick}>
      Click me
    </button>
    {circuits
      ? <div>
        Circuit pool size: {circuits.inner.size} / {circuits.inner.capacity}
      </div>
      : <div>
        Loading...
      </div>}
    {sessions
      ? <div>
        Socket pool size: {sessions.inner.size} / {sessions.inner.capacity}
      </div>
      : <div>
        Loading...
      </div>}
  </>
}
