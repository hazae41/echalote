import { Circuit, Creator, TorClientDuplex, TorClientParams, createPooledCircuit, createPooledTor, createWebSocketSnowflakeStream, tryCreateLoop } from "@hazae41/echalote"
import { Mutex } from "@hazae41/mutex"
import { Pool, PoolParams } from "@hazae41/piscine"
import { Ok, Result } from "@hazae41/result"

export async function tryCreateTor(params: TorClientParams) {
  const tcp = await createWebSocketSnowflakeStream("wss://snowflake.torproject.net/")
  const tor = new TorClientDuplex(tcp, params)

  return tor.tryWait().then(r => r.mapSync(() => tor))
}

export function createTorPool<CreateError>(tryCreate: Creator<TorClientDuplex, CreateError>, params: PoolParams = {}) {
  return new Mutex(new Pool<TorClientDuplex, Error | CreateError>(async (params) => {
    return await Result.unthrow(async t => {
      const tor = await tryCreateLoop(tryCreate, params).then(r => r.throw(t))

      return new Ok(createPooledTor(tor, params))
    })
  }, params))
}

export function createCircuitPool<TorPoolError>(tors: Mutex<Pool<TorClientDuplex, TorPoolError>>, params: PoolParams = {}) {
  const pool = new Mutex(new Pool<Circuit, Error | TorPoolError>(async (params) => {
    return await Result.unthrow(async t => {
      const { index, signal } = params

      const tor = await tors.inner.tryGet(index % tors.inner.capacity).then(r => r.throw(t))
      const circuit = await tor.tryCreateAndExtendLoop(signal).then(r => r.throw(t))

      return new Ok(createPooledCircuit(circuit, params))
    })
  }, params))

  pool.inner.signal.addEventListener("abort", async (reason) => {
    tors.inner.abort(reason)

    return Ok.void()
  }, { passive: true, once: true })

  tors.inner.signal.addEventListener("abort", async (reason) => {
    pool.inner.abort(reason)

    return Ok.void()
  }, { passive: true, once: true })

  return pool
}