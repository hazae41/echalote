import { Opaque, Writable } from "@hazae41/binary"
import { Box } from "@hazae41/box"
import { Ciphers, TlsClientDuplex } from "@hazae41/cadenas"
import { Disposer } from "@hazae41/cleaner"
import { Circuit, Consensus, TorClientDuplex, createPooledCircuitDisposer, createPooledTorDisposer, createWebSocketSnowflakeStream } from "@hazae41/echalote"
import { fetch } from "@hazae41/fleche"
import { Mutex } from "@hazae41/mutex"
import { None } from "@hazae41/option"
import { Cancel, Looped, Looper, Pool, PoolParams, Retry, tryLoop } from "@hazae41/piscine"
import { Catched, Ok, Result } from "@hazae41/result"

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

export async function tryOpenAs(circuit: Circuit, input: RequestInfo | URL) {
  return await Result.runAndWrap(async () => {
    return await openAsOrThrow(circuit, input)
  }).then(r => r.mapErrSync(Catched.from))
}

export async function tryCreateTor(): Promise<Result<TorClientDuplex, Cancel<Error> | Retry<Error>>> {
  return await Result.unthrow(async t => {
    const tcp = await createWebSocketSnowflakeStream("wss://snowflake.torproject.net/")
    // const tcp = await createMeekStream("http://localhost:8080/")

    const tor = new TorClientDuplex()

    tcp.outer.readable
      .pipeTo(tor.inner.writable)
      .catch(console.error)

    tor.inner.readable
      .pipeTo(tcp.outer.writable)
      .catch(console.error)

    await tor.tryWait().then(r => r.mapErrSync(Retry.new).throw(t))

    return new Ok(tor)
  })
}

export function createTorPool(tryCreate: Looper<TorClientDuplex, Looped<Error>>, params: PoolParams = {}) {
  return new Mutex(new Pool<TorClientDuplex>(async (params) => {
    return await Result.unthrow(async t => {
      using tor = new Box(await tryLoop(tryCreate).then(r => r.throw(t)))
      return new Ok(createPooledTorDisposer(tor.moveOrThrow(), params))
    })
  }, params))
}

export function createCircuitPool(tors: Mutex<Pool<TorClientDuplex>>, consensus: Consensus, params: PoolParams) {
  const middles = consensus.microdescs.filter(it => true
    && it.flags.includes("Fast")
    && it.flags.includes("Stable")
    && it.flags.includes("V2Dir"))

  const exits = consensus.microdescs.filter(it => true
    && it.flags.includes("Fast")
    && it.flags.includes("Stable")
    && it.flags.includes("Exit")
    && !it.flags.includes("BadExit"))

  return new Mutex(new Pool<Circuit>(async (params) => {
    const uuid = crypto.randomUUID()

    return await Result.unthrow<Result<Disposer<Box<Circuit>>, Error>>(async t => {
      const { index, pool, signal } = params

      console.log("waiting for tor...", uuid)

      const tor = await tors.inner.tryGetOrWait(index % tors.inner.capacity, signal).then(r => r.throw(t).inspectErrSync(() => {
        tors.inner.events.on("started", async i => {
          if (i !== (index % tors.inner.capacity))
            return new None()
          pool.restart(index)
          return new None()
        }, { signal, passive: true, once: true })
      }).throw(t).inner.inner)

      console.log("creating circuit...", uuid)

      using circuit = await tryLoop<Box<Circuit>, Looped<Error>>(async () => {
        return await Result.unthrow(async t => {
          using circuit = new Box(await tor.tryCreate(AbortSignal.timeout(1000)).then(r => r.mapErrSync(Cancel.new).throw(t)))

          /**
           * Try to extend to middle relay 9 times before giving up this circuit
           */
          await tryLoop(() => {
            return Result.unthrow<Result<void, Looped<Error>>>(async t => {
              const head = middles[Math.floor(Math.random() * middles.length)]
              const body = await Consensus.Microdesc.tryFetch(circuit.inner, head).then(r => r.mapErrSync(Cancel.new).throw(t))
              await circuit.inner.tryExtend(body, AbortSignal.timeout(1000)).then(r => r.mapErrSync(Retry.new).throw(t))

              return Ok.void()
            })
          }, { max: 3 }).then(r => r.mapErrSync(Retry.new).throw(t))

          /**
           * Try to extend to exit relay 9 times before giving up this circuit
           */
          await tryLoop(() => {
            return Result.unthrow<Result<void, Looped<Error>>>(async t => {
              const head = exits[Math.floor(Math.random() * exits.length)]
              const body = await Consensus.Microdesc.tryFetch(circuit.inner, head).then(r => r.mapErrSync(Cancel.new).throw(t))
              await circuit.inner.tryExtend(body, AbortSignal.timeout(1000)).then(r => r.mapErrSync(Retry.new).throw(t))

              return Ok.void()
            })
          }, { max: 3 }).then(r => r.mapErrSync(Retry.new).throw(t))

          /**
           * Try to open a stream to a reliable endpoint
           */
          using stream = await tryOpenAs(circuit.inner, "http://example.com/").then(r => r.mapErrSync(Retry.new).throw(t))

          /**
           * Reliability test
           */
          for (let i = 0; i < 3; i++) {
            /**
             * Speed test
             */
            const signal = AbortSignal.timeout(1000)

            await Result.runAndDoubleWrap(async () => {
              await fetch("http://example.com/", { stream: stream.inner, signal, preventAbort: true, preventCancel: true, preventClose: true }).then(r => r.text())
            }).then(r => r.mapErrSync(Retry.new).throw(t))
          }

          return new Ok(circuit.moveOrThrow())
        })
      }, { max: 9 }).then(r => r.throw(t))

      console.log("circuit opened...", uuid)

      return new Ok(createPooledCircuitDisposer(circuit.moveOrThrow(), params))
    })
  }, params))
}

export function createStreamPool(url: URL, circuits: Mutex<Pool<Circuit>>, params: PoolParams) {
  return new Mutex(new Pool<Disposer<Mutex<ReadableWritablePair<Opaque, Writable>>>>(async (params) => {
    const uuid = crypto.randomUUID()

    return await Result.unthrow<Result<Disposer<Box<Disposer<Mutex<ReadableWritablePair<Opaque, Writable>>>>>, Error>>(async t => {
      const { pool, index, signal } = params

      console.log("waiting for circuit...", uuid)

      // const circuit = await circuits.inner.trySync(params).then(r => r.throw(t).throw(t).inner.inner)

      using circuit = await Pool.tryTakeCryptoRandom(circuits).then(r => r.throw(t).inspectErrSync(() => {
        circuits.inner.events.on("started", async () => {
          pool.restart(index)
          return new None()
        }, { signal, passive: true, once: true })
      }).throw(t).inner)

      console.log("creating stream...", uuid)
      using stream = new Box(await tryOpenAs(circuit.inner, url.origin).then(r => r.throw(t)))

      const circuit2 = circuit.moveOrThrow()
      const stream2 = stream.moveOrThrow()

      console.debug("stream opened...", uuid)

      const onStreamClean = () => {
        stream2[Symbol.dispose]()
        circuit2[Symbol.dispose]()
        console.log("stream disposed", uuid)
      }

      let closed = false

      const onCloseOrError = async (reason?: unknown) => {
        if (closed) return
        closed = true

        console.debug("stream closed", uuid, { reason })
        pool.restart(index)

        return new None()
      }

      const inputer = new TransformStream<Opaque, Opaque>({})
      const outputer = new TransformStream<Writable, Writable>({})

      stream.inner.inner.readable.pipeTo(inputer.writable, { signal, preventCancel: true }).then(onCloseOrError).catch(onCloseOrError)
      outputer.readable.pipeTo(stream.inner.inner.writable, { signal, preventAbort: true, preventClose: true }).then(onCloseOrError).catch(onCloseOrError)

      const outer = {
        readable: inputer.readable,
        writable: outputer.writable
      } as const

      const mutex = new Box(new Disposer(new Mutex(outer), onStreamClean))

      return new Ok(new Disposer(mutex, onCloseOrError))
    }).then(r => r.inspectErrSync(e => console.warn("stream errored", uuid, { e })))
  }, params))
}