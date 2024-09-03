import { Box, Deferred, Stack } from "@hazae41/box";
import { Ciphers, TlsClientDuplex } from "@hazae41/cadenas";
import { Disposer } from "@hazae41/disposer";
import { Circuit, Consensus, TorClientDuplex } from "@hazae41/echalote";
import { fetch } from "@hazae41/fleche";
import { loopOrThrow, Pool, Retry } from "@hazae41/piscine";
import { SizedPool } from "libs/pool";

export async function openAsOrThrow(circuit: Circuit, input: RequestInfo | URL) {
  const req = new Request(input)
  const url = new URL(req.url)

  if (url.protocol === "http:" || url.protocol === "ws:") {
    const tcp = await circuit.openOrThrow(url.hostname, Number(url.port) || 80)

    return new Disposer(tcp.outer, () => tcp.close())
  }

  if (url.protocol === "https:" || url.protocol === "wss:") {
    const tcp = await circuit.openOrThrow(url.hostname, Number(url.port) || 443)

    const ciphers = [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384]
    const tls = new TlsClientDuplex({ host_name: url.hostname, ciphers })

    tcp.outer.readable.pipeTo(tls.inner.writable).catch(() => { })
    tls.inner.readable.pipeTo(tcp.outer.writable).catch(() => { })

    return new Disposer(tls.outer, () => tcp.close())
  }

  throw new Error(url.protocol)
}

export function createCircuitEntry(pool: Pool<Circuit>, index: number, circuit: Circuit) {
  using stack = new Box(new Stack())

  const entry = new Box(circuit)
  stack.getOrThrow().push(entry)

  const onCloseOrError = async (reason?: unknown) => void pool.restart(index)

  stack.getOrThrow().push(new Deferred(circuit.events.on("close", onCloseOrError, { passive: true })))
  stack.getOrThrow().push(new Deferred(circuit.events.on("error", onCloseOrError, { passive: true })))

  const unstack = stack.unwrapOrThrow()

  return new Disposer(entry, () => unstack[Symbol.dispose]())
}

export function createCircuitPool(tors: SizedPool<TorClientDuplex>, consensus: Consensus, size: number) {
  const middles = consensus.microdescs.filter(it => true
    && it.flags.includes("Fast")
    && it.flags.includes("Stable")
    && it.flags.includes("V2Dir"))

  const exits = consensus.microdescs.filter(it => true
    && it.flags.includes("Fast")
    && it.flags.includes("Stable")
    && it.flags.includes("Exit")
    && !it.flags.includes("BadExit"))

  let update = Date.now()

  const pool: Pool<Circuit> = new Pool<Circuit>(async (params) => {
    const { index, signal } = params
    const [uuid] = crypto.randomUUID().split("-")

    while (!signal.aborted) {
      const start = Date.now()

      try {
        const tor = await tors.pool.getOrThrow(index % tors.size, signal)

        const circuit = await loopOrThrow(async () => Retry.run(async () => {
          try {
            using circuit = new Box(await tor.createOrThrow(AbortSignal.timeout(1000)))

            console.log(`Circuit #${uuid} opened`)

            /**
             * Try to extend to middle relay 9 times before giving up this circuit
             */
            await loopOrThrow(async () => {
              const head = middles[Math.floor(Math.random() * middles.length)]
              const body = await Consensus.Microdesc.fetchOrThrow(circuit.getOrThrow(), head, AbortSignal.timeout(1000))
              await Retry.run(() => circuit.getOrThrow().extendOrThrow(body, AbortSignal.timeout(1000)))
            }, { max: 3 })

            console.log(`Circuit #${uuid} extended once`)

            /**
             * Try to extend to exit relay 9 times before giving up this circuit
             */
            await loopOrThrow(async () => {
              const head = exits[Math.floor(Math.random() * exits.length)]
              const body = await Consensus.Microdesc.fetchOrThrow(circuit.getOrThrow(), head, AbortSignal.timeout(1000))
              await Retry.run(() => circuit.getOrThrow().extendOrThrow(body, AbortSignal.timeout(1000)))
            }, { max: 3 })

            console.log(`Circuit #${uuid} extended twice`)

            /**
             * Try to open a stream to a reliable endpoint
             */
            using stream = await openAsOrThrow(circuit.getOrThrow(), "http://example.com/")

            console.log(`Circuit #${uuid} speed test opend`)

            /**
             * Reliability test
             */
            for (let i = 0; i < 3; i++) {
              /**
               * Speed test
               */
              await fetch("http://example.com/", { stream: stream.inner, signal: AbortSignal.timeout(1000), preventAbort: true, preventCancel: true, preventClose: true }).then(r => r.text())
            }

            console.log(`Circuit #${uuid} speed test done`)

            return circuit.unwrapOrThrow()
          } catch (e: unknown) {
            console.error(`Circuit #${uuid} thrown`, e)
            throw e
          }
        }), { max: 9 })

        console.log(`Circuit #${uuid} ready`)

        return createCircuitEntry(pool, index, circuit)
      } catch (e: unknown) {
        console.error(`Circuit ${uuid} errored`, e)

        if (start < update)
          continue
        throw e
      }
    }

    throw new Error("Aborted", { cause: signal.reason })
  })

  const onStarted = () => {
    update = Date.now()

    for (const entry of pool.errEntries)
      pool.restart(entry.index)

    return
  }

  const stack = new Stack()

  tors.pool.events.on("started", onStarted, { passive: true })
  stack.push(new Deferred(() => tors.pool.events.off("started", onStarted)))

  return new Disposer(SizedPool.start(pool, size), () => stack[Symbol.dispose]())
}