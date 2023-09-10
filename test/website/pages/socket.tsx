import { Berith } from "@hazae41/berith";
import { Ed25519 } from "@hazae41/ed25519";
import { Morax } from "@hazae41/morax";
import { None } from "@hazae41/option";
import { Sha1 } from "@hazae41/sha1";
import { X25519 } from "@hazae41/x25519";
import { createCircuitPool, createTorPool, tryCreateTor } from "libs/circuits/circuits";
import { Session, createSessionPool } from "libs/sockets/pool";
import { DependencyList, useCallback, useEffect, useMemo, useState } from "react";

const eth_call = { "jsonrpc": "2.0", "id": 21, "method": "eth_call", "params": [{ "to": "0x1f98415757620b543a52e61c46b32eb19261f984", "data": "0x1749e1e30000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000700000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000260000000000000000000000000000000000000000000000000000000000000032000000000000000000000000000000000000000000000000000000000000003c00000000000000000000000000000000000000000000000000000000000000460000000000000000000000000000000000000000000000000000000000000052000000000000000000000000000000000000c2e074ec69a0dfb2997ba6c7d2e1e00000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000240178b8bfd4b63be5dc653a81f793311d472893a9fba1cf21a22bde8747ebf6af4a89cb910000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c2e074ec69a0dfb2997ba6c7d2e1e00000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000240178b8bfdac646d3c984f08aff3937648f4f95365e531e218e91a2bff2d6d798c30eb50000000000000000000000000000000000000000000000000000000000000000000000000000000000122eb74f9d0f1a5ed587f43d120c1c2bbdb9360b00000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000243b3b57ded4b63be5dc653a81f793311d472893a9fba1cf21a22bde8747ebf6af4a89cb9100000000000000000000000000000000000000000000000000000000000000000000000000000000169e633a2d1e6c10dd91238ba11c4a708dfef37c00000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000450d25bcd000000000000000000000000000000000000000000000000000000000000000000000000000000001f98415757620b543a52e61c46b32eb19261f98400000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000040f28c97d000000000000000000000000000000000000000000000000000000000000000000000000000000001f98415757620b543a52e61c46b32eb19261f98400000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000244d2301cc00000000000000000000000005cb48dd2b5911b90d464fc61d5febc2ce374fd40000000000000000000000000000000000000000000000000000000000000000000000000000000065770b5283117639760bea3f867b69b3697a91dd000000000000000000000000000000000000000000000000000000000002d2a80000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002470a0823100000000000000000000000005cb48dd2b5911b90d464fc61d5febc2ce374fd400000000000000000000000000000000000000000000000000000000" }, "0x10b7963"] }

const irn_subscribe = { "jsonrpc": "2.0", "method": "irn_subscribe", "params": { topic: "01d4c9f7a4d83ac4e162d518c3e430cd58f392e831f099b4f81c85f367c3aa09" }, "id": "1692551207426770945" }

async function superfetch(session: Session) {
  const { sockets, circuit } = session

  const socket = await sockets.inner.tryGet(0).then(r => r.unwrap())

  const start = Date.now()

  socket.send(JSON.stringify(irn_subscribe))

  console.log(JSON.stringify(irn_subscribe))

  const event = await new Promise<MessageEvent>((ok, err) => {
    socket.addEventListener("message", ok)
    socket.addEventListener("error", err)
  })

  console.log(event.data, Date.now() - start)

  // socket.close()

  // await circuit.tryDestroy().then(r => r.unwrap())
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

  const params = useAsyncMemo(async () => {
    // const ed25519 = Ed25519.fromNoble(noble_ed25519.ed25519)
    // const x25519 = X25519.fromNoble(noble_ed25519.x25519)
    // const sha1 = Sha1.fromNoble(noble_sha1.sha1)

    const ed25519 = await Ed25519.fromSafeOrBerith(Berith)
    const x25519 = await X25519.fromSafeOrBerith(Berith)

    Morax.initSyncBundledOnce()
    const sha1 = Sha1.fromMorax(Morax)

    const fallbacksUrl = "https://raw.githubusercontent.com/hazae41/echalote/master/tools/fallbacks/fallbacks.json"
    const fallbacksRes = await fetch(fallbacksUrl)

    if (!fallbacksRes.ok)
      throw new Error(await fallbacksRes.text())

    const fallbacks = await fallbacksRes.json()

    return { fallbacks, ed25519, sha1, x25519 }
  }, [])

  const tors = useAsyncMemo(async () => {
    if (!params) return

    return createTorPool(async () => {
      return await tryCreateTor(params)
    }, { capacity: 1 })
  }, [params])

  const circuits = useMemo(() => {
    if (!tors) return

    return createCircuitPool(tors, { capacity: 1 })
  }, [tors])

  const sessions = useMemo(() => {
    if (!circuits) return

    return createSessionPool(circuits, { capacity: 1 })
  }, [circuits])

  const onClick = useCallback(async () => {
    try {
      if (!sessions || sessions.locked) return

      const session = await sessions.inner.tryGet(0).then(r => r.unwrap())

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
      return new None()
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
