import { Opaque, Writable } from "@hazae41/binary"
import { Ciphers, TlsClientDuplex } from "@hazae41/cadenas"
import { Disposer } from "@hazae41/cleaner"
import { Circuit, Consensus, TorClientDuplex, createPooledCircuitDisposer, createPooledTorDisposer, createWebSocketSnowflakeStream } from "@hazae41/echalote"
import { fetch } from "@hazae41/fleche"
import { Mutex } from "@hazae41/mutex"
import { None } from "@hazae41/option"
import { Cancel, Looped, Looper, Pool, PoolParams, Retry, TooManyRetriesError, tryLoop } from "@hazae41/piscine"
import { AbortedError } from "@hazae41/plume"
import { Catched, Ok, Result } from "@hazae41/result"

export async function openAsOrThrow(circuit: Circuit, input: RequestInfo | URL) {
  const req = new Request(input)
  const url = new URL(req.url)

  if (url.protocol === "http:") {
    const tcp = await circuit.openOrThrow(url.hostname, Number(url.port) || 80)

    return tcp.outer
  }

  if (url.protocol === "https:") {
    const tcp = await circuit.openOrThrow(url.hostname, Number(url.port) || 443)

    const ciphers = [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384]
    const tls = new TlsClientDuplex({ host_name: url.hostname, ciphers })

    tcp.outer.readable.pipeTo(tls.inner.writable).catch(() => { })
    tls.inner.readable.pipeTo(tcp.outer.writable).catch(() => { })

    return tls.outer
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

export function createTorPool<CreateError extends Looped.Infer<CreateError>>(tryCreate: Looper<TorClientDuplex, CreateError>, params: PoolParams = {}) {
  return new Mutex(new Pool<Disposer<TorClientDuplex>, Cancel.Inner<CreateError> | AbortedError | TooManyRetriesError>(async (params) => {
    return await Result.unthrow(async t => {
      const tor = await tryLoop(tryCreate, params).then(r => r.throw(t))
      return new Ok(createPooledTorDisposer(tor, params))
    })
  }, params))
}

export function createCircuitPool(tors: Mutex<Pool<Disposer<TorClientDuplex>, Error>>, consensus: Consensus, params: PoolParams) {
  const middles = consensus.microdescs.filter(it => true
    && it.flags.includes("Fast")
    && it.flags.includes("Stable")
    && it.flags.includes("V2Dir"))

  const exits = consensus.microdescs.filter(it => true
    && it.flags.includes("Fast")
    && it.flags.includes("Stable")
    && it.flags.includes("Exit")
    && !it.flags.includes("BadExit"))

  return new Mutex(new Pool<Disposer<Circuit>, Error>(async (params) => {
    return await Result.unthrow<Result<Disposer<Circuit>, Error>>(async t => {
      const { index } = params

      const tor = await tors.inner.tryGet(index % tors.inner.capacity).then(r => r.throw(t).throw(t).inner)

      const circuit = await tryLoop<Circuit, Looped<Error>>(async () => {
        return await Result.unthrow<Result<Circuit, Looped<Error>>>(async t => {
          const circuit = await tor.tryCreate(AbortSignal.timeout(1000)).then(r => r.mapErrSync(Cancel.new).throw(t))

          /**
           * Try to extend to middle relay 9 times before giving up this circuit
           */
          await tryLoop(() => {
            return Result.unthrow<Result<void, Looped<Error>>>(async t => {
              const head = middles[Math.floor(Math.random() * middles.length)]
              const body = await Consensus.Microdesc.tryFetch(circuit, head).then(r => r.mapErrSync(Cancel.new).throw(t))
              await circuit.tryExtend(body, AbortSignal.timeout(1000)).then(r => r.mapErrSync(Retry.new).throw(t))

              return Ok.void()
            })
          }, { max: 3 }).then(r => r.mapErrSync(Retry.new).throw(t))

          /**
           * Try to extend to exit relay 9 times before giving up this circuit
           */
          await tryLoop(() => {
            return Result.unthrow<Result<void, Looped<Error>>>(async t => {
              const head = exits[Math.floor(Math.random() * exits.length)]
              const body = await Consensus.Microdesc.tryFetch(circuit, head).then(r => r.mapErrSync(Cancel.new).throw(t))
              await circuit.tryExtend(body, AbortSignal.timeout(1000)).then(r => r.mapErrSync(Retry.new).throw(t))

              return Ok.void()
            })
          }, { max: 3 }).then(r => r.mapErrSync(Retry.new).throw(t))

          /**
           * Try to open a stream to a reliable endpoint
           */
          const stream = await tryOpenAs(circuit, "http://example.com/").then(r => r.mapErrSync(Retry.new).throw(t))

          /**
           * Reliability test
           */
          for (let i = 0; i < 3; i++) {
            /**
             * Speed test
             */
            const signal = AbortSignal.timeout(1000)

            await Result.runAndDoubleWrap(async () => {
              await fetch("http://example.com/", { stream, signal, preventAbort: true, preventCancel: true, preventClose: true }).then(r => r.text())
            }).then(r => r.mapErrSync(Retry.new).throw(t))
          }

          return new Ok(circuit)
        })
      }, { max: 9 }).then(r => r.throw(t))

      return new Ok(createPooledCircuitDisposer(circuit, params))
    })
  }, params))
}

export function createStreamPool(circuits: Mutex<Pool<Disposer<Circuit>, Error>>, params: PoolParams) {
  return new Mutex(new Pool<Disposer<Mutex<ReadableWritablePair<Opaque<Uint8Array>, Writable>>>, Error>(async (params) => {
    return await Result.unthrow(async t => {
      const { pool, index } = params

      const circuit = await circuits.inner.tryGet(index % circuits.inner.capacity).then(r => r.throw(t).throw(t).inner)

      const stream = await tryOpenAs(circuit, "https://eth.llamarpc.com").then(r => r.throw(t))

      const controller = new AbortController()
      const { signal } = controller

      const onCloseOrError = async (reason?: unknown) => {
        if (signal.aborted) return

        controller.abort(reason)
        await pool.restart(index)

        return new None()
      }

      const inputer = new TransformStream<Opaque, Opaque>({})
      const outputer = new TransformStream<Writable, Writable>({})

      stream.readable.pipeTo(inputer.writable, { signal }).then(onCloseOrError).catch(onCloseOrError)
      outputer.readable.pipeTo(stream.writable, { signal }).then(onCloseOrError).catch(onCloseOrError)

      const outer = {
        readable: inputer.readable,
        writable: outputer.writable
      } as const

      const mutex = new Mutex(outer)

      return new Ok(new Disposer(mutex, () => controller.abort("Disposing")))
    })
  }, params))
}