import { Berith } from "@hazae41/berith";
import { Ed25519 } from "@hazae41/ed25519";
import { Morax } from "@hazae41/morax";
import { Pool } from "@hazae41/piscine";
import { Ok } from "@hazae41/result";
import { Sha1 } from "@hazae41/sha1";
import { X25519 } from "@hazae41/x25519";
import { SocketAndCircuit, createSocketAndCircuitPool } from "libs/sockets/pool";
import { createTorPool } from "mods/tor";
import { DependencyList, useCallback, useEffect, useMemo, useState } from "react";
import { createCircuitPoolFromTorPool } from "../../../dist/types";

async function superfetch(socketAndCircuit: SocketAndCircuit) {
  const { socket, circuit } = socketAndCircuit

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

  const sockets = useMemo(() => {
    if (!circuits) return

    const url = new URL("wss://mainnet.infura.io/ws/v3/b6bf7d3508c941499b10025c0776eaf8")

    return createSocketAndCircuitPool(circuits, { url, capacity: 9 })
  }, [circuits])

  const onClick = useCallback(async () => {
    try {
      if (!sockets || sockets.locked) return

      const socket = await Pool
        .takeCryptoRandom(sockets)
        .then(r => r.unwrap())

      await superfetch(socket)
    } catch (e: unknown) {
      console.error("onClick", { e })
    }
  }, [sockets])

  const [_, setCounter] = useState(0)

  useEffect(() => {
    if (!sockets) return

    const onCreatedOrDeleted = () => {
      setCounter(c => c + 1)
      return Ok.void()
    }

    sockets.inner.events.on("created", onCreatedOrDeleted, { passive: true })
    sockets.inner.events.on("deleted", onCreatedOrDeleted, { passive: true })

    return () => {
      sockets.inner.events.off("created", onCreatedOrDeleted)
      sockets.inner.events.off("deleted", onCreatedOrDeleted)
    }
  }, [sockets])

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
    {sockets
      ? <div>
        Socket pool size: {sockets.inner.size} / {sockets.inner.capacity}
      </div>
      : <div>
        Loading...
      </div>}
  </>
}
