import { Opaque, Writable } from "@hazae41/binary"
import { Disposer } from "@hazae41/cleaner"
import { Circuit, TorClientDuplex, TorClientParams, createPooledCircuitDisposer, createPooledTorDisposer, createWebSocketSnowflakeStream } from "@hazae41/echalote"
import { Mutex } from "@hazae41/mutex"
import { None } from "@hazae41/option"
import { Cancel, Looped, Looper, Pool, PoolParams, Retry, TooManyRetriesError, tryLoop } from "@hazae41/piscine"
import { AbortedError } from "@hazae41/plume"
import { Ok, Result } from "@hazae41/result"

export async function tryCreateTor(params: TorClientParams): Promise<Result<TorClientDuplex, Cancel<Error> | Retry<Error>>> {
  return await Result.unthrow(async t => {
    const tcp = await createWebSocketSnowflakeStream("wss://snowflake.torproject.net/")

    const tor = new TorClientDuplex(params)

    tcp.readable
      .pipeTo(tor.inner.writable)
      .catch(console.error)

    tor.inner.readable
      .pipeTo(tcp.writable)
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


export function createCircuitPool(tors: Mutex<Pool<Disposer<TorClientDuplex>, Error>>, params: PoolParams) {
  return new Mutex(new Pool<Disposer<Circuit>, Error>(async (params) => {
    return await Result.unthrow(async t => {
      const { index, signal } = params

      const tor = await tors.inner.tryGet(index % tors.inner.capacity).then(r => r.throw(t).throw(t))
      const circuit = await tor.inner.tryCreateAndExtendLoop(signal).then(r => r.throw(t))

      return new Ok(createPooledCircuitDisposer(circuit, params))
    })
  }, params))
}

export function createStreamPool<TorPoolError>(circuits: Mutex<Pool<Disposer<Circuit>, TorPoolError>>, params: PoolParams) {
  return new Mutex(new Pool<Disposer<ReadableWritablePair<Opaque<Uint8Array>, Writable>>, Error | TorPoolError>(async (params) => {
    return await Result.unthrow(async t => {
      const { pool, index, signal } = params

      const circuit = await circuits.inner.tryGet(index % circuits.inner.capacity).then(r => r.throw(t).throw(t))
      const stream = await circuit.inner.openAsOrThrow("https://eth.llamarpc.com")

      const inputer = new TransformStream<Opaque, Opaque>({})
      const outputer = new TransformStream<Writable, Writable>({})

      const onCloseOrError = async (reason?: unknown) => {
        console.error("Stream closed", reason)
        await pool.restart(index)
        return new None()
      }

      stream.readable.pipeTo(inputer.writable, { signal }).finally(onCloseOrError).catch(() => { })
      outputer.readable.pipeTo(stream.writable, { signal }).finally(onCloseOrError).catch(() => { })

      const readable = inputer.readable
      const writable = outputer.writable
      const outer = { readable, writable }

      return new Ok(new Disposer(outer, () => { }))
    })
  }, params))
}