import { Disposer } from "@hazae41/cleaner"
import { Circuit, TorClientDuplex, TorClientParams, createPooledCircuit, createPooledTor, createWebSocketSnowflakeStream } from "@hazae41/echalote"
import { Mutex } from "@hazae41/mutex"
import { Cancel, Looped, Looper, Pool, PoolParams, Retry, TooManyRetriesError, tryLoop } from "@hazae41/piscine"
import { AbortedError } from "@hazae41/plume"
import { Ok, Result } from "@hazae41/result"

export async function tryCreateTor(params: TorClientParams): Promise<Result<TorClientDuplex, Cancel<Error> | Retry<Error>>> {
  return await Result.unthrow(async t => {
    const tcp = await createWebSocketSnowflakeStream("wss://snowflake.torproject.net/")
    const tor = new TorClientDuplex(tcp, params)

    await tor.tryWait().then(r => r.mapErrSync(Retry.new).throw(t))

    return new Ok(tor)
  })
}


export function createTorPool<CreateError extends Looped.Infer<CreateError>>(tryCreate: Looper<TorClientDuplex, CreateError>, params: PoolParams = {}) {
  return new Mutex(new Pool<Disposer<TorClientDuplex>, Cancel.Inner<CreateError> | AbortedError | TooManyRetriesError>(async (params) => {
    return await Result.unthrow(async t => {
      const tor = await tryLoop(tryCreate, params).then(r => r.throw(t))

      return new Ok(createPooledTor(tor, params))
    })
  }, params))
}


export function createCircuitPool<TorPoolError>(tors: Mutex<Pool<Disposer<TorClientDuplex>, TorPoolError>>, params: PoolParams) {
  return new Mutex(new Pool<Disposer<Circuit>, Error | TorPoolError>(async (params) => {
    return await Result.unthrow(async t => {
      const { index, signal } = params

      const tor = await tors.inner.tryGet(index % tors.inner.capacity).then(r => r.throw(t))
      const circuit = await tor.inner.tryCreateAndExtendLoop(signal).then(r => r.throw(t))

      return new Ok(createPooledCircuit(circuit, params))
    })
  }, params))
}