import { Opaque, Writable } from "@hazae41/binary"
import { Disposer } from "@hazae41/cleaner"
import { Circuit, TorClientDuplex, TorClientParams, TorStreamDuplex, createPooledCircuitDisposer, createPooledTorDisposer, createWebSocketSnowflakeStream } from "@hazae41/echalote"
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

export interface PooledTor {
  readonly tor: TorClientDuplex
  readonly circuits: Mutex<Pool<Disposer<PooledCircuit>, Error>>
}

export interface PooledCircuit {
  readonly circuit: Circuit
  readonly streams: Mutex<Pool<Disposer<TorStreamDuplex>, Error>>
}

export function createTorPool2(params: TorClientParams & PoolParams) {
  return new Mutex(new Pool<Disposer<PooledTor>, Error>(async p => {
    const tor = await tryCreateTor(params).then(r => r.unwrap())
    console.warn("new tor")
    const circuits = createCircuitPool2(tor, params)

    return new Ok(new Disposer({ tor, circuits }, () => { }))
  }, { capacity: 1 }))
}

export function createCircuitPool2(tor: TorClientDuplex, params: PoolParams = {}) {
  return new Mutex(new Pool<Disposer<PooledCircuit>, Error>(async p => {
    const circuit = await tor.tryCreate().then(r => r.unwrap())
    console.log("new circuit")
    const streams = createStreamPool2(circuit, params)

    return new Ok(new Disposer({ circuit, streams }, () => { }))
  }, { capacity: 1 }))
}

export function createStreamPool2(circuit: Circuit, params: PoolParams = {}) {
  return new Mutex(new Pool<Disposer<TorStreamDuplex>, Error>(async p => {
    const stream = await circuit.openDirOrThrow()
    console.log("new stream")

    return new Ok(new Disposer(stream, () => { }))
  }, { capacity: 1 }))
}

export function createTorPool<CreateError extends Looped.Infer<CreateError>>(tryCreate: Looper<TorClientDuplex, CreateError>, params: PoolParams = {}) {
  return new Mutex(new Pool<Disposer<TorClientDuplex>, Cancel.Inner<CreateError> | AbortedError | TooManyRetriesError>(async (params) => {
    return await Result.unthrow(async t => {
      const tor = await tryLoop(tryCreate, params).then(r => r.unwrap())

      return new Ok(createPooledTorDisposer(tor, params))
    })
  }, params))
}

export function createCircuitPool(tors: Mutex<Pool<Disposer<TorClientDuplex>, Error>>, params: PoolParams) {
  return new Mutex(new Pool<Disposer<Circuit>, Error>(async (params) => {
    return await Result.unthrow<Result<Disposer<Circuit>, Error>>(async t => {
      const { index, signal } = params

      const tor = await tors.inner.tryGet(index % tors.inner.capacity).then(r => r.throw(t).throw(t))
      const circuit = await tor.inner.tryCreateAndExtendLoop(signal).then(r => r.throw(t))

      return new Ok(createPooledCircuitDisposer(circuit, params))
    }).then(r => r.inspectErrSync(e => console.error({ e })))
  }, params))
}

export function createStreamPool<TorPoolError>(circuits: Mutex<Pool<Disposer<Circuit>, TorPoolError>>, params: PoolParams) {
  return new Mutex(new Pool<Disposer<ReadableWritablePair<Opaque<Uint8Array>, Writable>>, Error | TorPoolError>(async (params) => {
    return await Result.unthrow(async t => {
      const { pool, index, signal } = params

      const circuit = await circuits.inner.tryGet(index % circuits.inner.capacity).then(r => r.throw(t).throw(t))
      const stream = await circuit.inner.openAsOrThrow("https://eth.llamarpc.com", { wait: true })

      const inputer = new TransformStream<Opaque, Opaque>({})
      const outputer = new TransformStream<Writable, Writable>({})

      const onCloseOrError = async (reason?: unknown) => {
        console.error("Stream closed", reason)
        await pool.restart(index)
        return new None()
      }

      stream.readable.pipeTo(inputer.writable, { signal }).then(onCloseOrError).catch(onCloseOrError)
      outputer.readable.pipeTo(stream.writable, { signal }).then(onCloseOrError).catch(onCloseOrError)

      const readable = inputer.readable
      const writable = outputer.writable
      const outer = { readable, writable }

      return new Ok(new Disposer(outer, () => { }))
    })
  }, params))
}