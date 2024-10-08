import { Consensus, Echalote } from "@hazae41/echalote";
import { Ed25519 } from "@hazae41/ed25519";
import { Ed25519Wasm } from "@hazae41/ed25519.wasm";
import { Sha1 } from "@hazae41/sha1";
import { Sha1Wasm } from "@hazae41/sha1.wasm";
import { X25519 } from "@hazae41/x25519";
import { X25519Wasm } from "@hazae41/x25519.wasm";
import { createCircuitPool } from "libs/circuits";
import { createFlecheWebSocketPool } from "libs/sockets";
import { createTorPool } from "libs/tors";
import { DependencyList, useCallback, useEffect, useMemo, useState } from "react";

const eth_call = { "jsonrpc": "2.0", "id": 21, "method": "eth_call", "params": [{ "to": "0x1f98415757620b543a52e61c46b32eb19261f984", "data": "0x1749e1e30000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000700000000000000000000000000000000000000000000000000000000000000e000000000000000000000000000000000000000000000000000000000000001a00000000000000000000000000000000000000000000000000000000000000260000000000000000000000000000000000000000000000000000000000000032000000000000000000000000000000000000000000000000000000000000003c00000000000000000000000000000000000000000000000000000000000000460000000000000000000000000000000000000000000000000000000000000052000000000000000000000000000000000000c2e074ec69a0dfb2997ba6c7d2e1e00000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000240178b8bfd4b63be5dc653a81f793311d472893a9fba1cf21a22bde8747ebf6af4a89cb910000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000c2e074ec69a0dfb2997ba6c7d2e1e00000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000240178b8bfdac646d3c984f08aff3937648f4f95365e531e218e91a2bff2d6d798c30eb50000000000000000000000000000000000000000000000000000000000000000000000000000000000122eb74f9d0f1a5ed587f43d120c1c2bbdb9360b00000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000243b3b57ded4b63be5dc653a81f793311d472893a9fba1cf21a22bde8747ebf6af4a89cb9100000000000000000000000000000000000000000000000000000000000000000000000000000000169e633a2d1e6c10dd91238ba11c4a708dfef37c00000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000450d25bcd000000000000000000000000000000000000000000000000000000000000000000000000000000001f98415757620b543a52e61c46b32eb19261f98400000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000040f28c97d000000000000000000000000000000000000000000000000000000000000000000000000000000001f98415757620b543a52e61c46b32eb19261f98400000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000000000000000000000000000000000000000006000000000000000000000000000000000000000000000000000000000000000244d2301cc00000000000000000000000005cb48dd2b5911b90d464fc61d5febc2ce374fd40000000000000000000000000000000000000000000000000000000000000000000000000000000065770b5283117639760bea3f867b69b3697a91dd000000000000000000000000000000000000000000000000000000000002d2a80000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000002470a0823100000000000000000000000005cb48dd2b5911b90d464fc61d5febc2ce374fd400000000000000000000000000000000000000000000000000000000" }, "0x10b7963"] }

// const irn_subscribe = { "jsonrpc": "2.0", "method": "irn_subscribe", "params": { topic: "01d4c9f7a4d83ac4e162d518c3e430cd58f392e831f099b4f81c85f367c3aa09" }, "id": "1692551207426770945" }

async function superfetch(socket: WebSocket) {
  const start = Date.now()

  socket.send(JSON.stringify({ "jsonrpc": "2.0", "method": "eth_blockNumber", "params": [], "id": 67 }))

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

  const tors = useAsyncMemo(async () => {
    // const ed25519 = Ed25519.fromNoble(noble_ed25519.ed25519)
    // const x25519 = X25519.fromNoble(noble_ed25519.x25519)
    // const sha1 = Sha1.fromNoble(noble_sha1.sha1)

    await Promise.all([Ed25519Wasm.initBundled(), X25519Wasm.initBundled(), Sha1Wasm.initBundled()])

    Ed25519.set(await Ed25519.fromNativeOrWasm(Ed25519Wasm))
    X25519.set(await X25519.fromNativeOrWasm(X25519Wasm))
    Sha1.set(Sha1.fromWasm(Sha1Wasm))

    Echalote.Console.debugging = true
    // Cadenas.Console.debugging = true

    return createTorPool(1)
  }, [])

  const consensus = useAsyncMemo(async () => {
    if (!tors) return

    const tor = await tors.get().pool.getCryptoRandomOrThrow()
    using circuit = await tor.createOrThrow(AbortSignal.timeout(5000))

    return await Consensus.fetchOrThrow(circuit)
  }, [tors])

  const circuits = useMemo(() => {
    if (!tors || !consensus) return

    return createCircuitPool(tors.get(), consensus, 9)
  }, [tors, consensus])

  const sockets = useMemo(() => {
    if (!circuits) return

    const url = new URL("wss://ethereum.publicnode.com")

    return createFlecheWebSocketPool(circuits.get(), url, 3)
  }, [circuits])

  const onClick = useCallback(async () => {
    if (!sockets)
      return

    try {
      const start = Date.now()

      using socket = await sockets.get().pool.takeCryptoRandomOrThrow()

      await superfetch(socket.inner)

      console.log("superfetch", Date.now() - start)
    } catch (e: unknown) {
      console.error("onClick", { e })
    }
  }, [sockets])

  const [_, setCounter] = useState(0)

  useEffect(() => {
    if (!circuits)
      return
    if (!sockets)
      return

    const onCreatedOrDeleted = () => setCounter(c => c + 1)

    circuits.get().pool.events.on("created", onCreatedOrDeleted, { passive: true })
    circuits.get().pool.events.on("deleted", onCreatedOrDeleted, { passive: true })

    sockets.get().pool.events.on("created", onCreatedOrDeleted, { passive: true })
    sockets.get().pool.events.on("deleted", onCreatedOrDeleted, { passive: true })

    return () => {
      circuits.get().pool.events.off("created", onCreatedOrDeleted)
      circuits.get().pool.events.off("deleted", onCreatedOrDeleted)

      sockets.get().pool.events.off("created", onCreatedOrDeleted)
      sockets.get().pool.events.off("deleted", onCreatedOrDeleted)
    }
  }, [circuits, sockets])

  return <>
    <button onClick={onClick}>
      Click me
    </button>
    {circuits
      ? <div>
        Circuit pool size: {circuits.get().pool.size} / {circuits.get().size}
      </div>
      : <div>
        Loading...
      </div>}
    {sockets
      ? <div>
        Socket pool size: {sockets.get().pool.size} / {sockets.get().size}
      </div>
      : <div>
        Loading...
      </div>}
  </>
}
