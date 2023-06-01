import { TorClientDuplex, TorClientParams, createWebSocketSnowflakeStream } from "@hazae41/echalote";
import { Mutex } from "@hazae41/mutex";
import { Pool, PoolParams } from "@hazae41/piscine";
import { AbortError, Cleanable } from "@hazae41/plume";
import { Err, Ok, Result } from "@hazae41/result";

export async function tryCreateTorLoop(params: TorClientParams): Promise<Result<TorClientDuplex, AbortError>> {
  const { signal, fallbacks, ed25519, x25519, sha1 } = params

  for (let i = 0; !signal?.aborted && i < 3; i++) {
    const tcp = await createWebSocketSnowflakeStream("wss://snowflake.torproject.net/")
    const tor = new TorClientDuplex(tcp, { fallbacks, ed25519, x25519, sha1, signal })

    const result = await tor.tryWait().then(r => r.ignore())

    if (result.isOk())
      return new Ok(tor)

    console.warn(`Tor creation failed`, { error: result.get() })
    continue
  }

  if (signal?.aborted)
    return new Err(AbortError.from(signal.reason))
  return new Err(new AbortError(`Took too long`))
}

export function createTorPool(params: TorClientParams & PoolParams) {
  const { fallbacks, ed25519, x25519, sha1, capacity, signal } = params

  const pool = new Pool<TorClientDuplex>(async ({ pool, index, signal }) => {
    return await Result.unthrow(async t => {
      const tor = await tryCreateTorLoop({ fallbacks, ed25519, x25519, sha1, signal }).then(r => r.throw(t))

      const onTorCloseOrError = async (reason?: unknown) => {
        pool.delete(index)
        return Ok.void()
      }

      tor.events.on("close", onTorCloseOrError, { passive: true })
      tor.events.on("error", onTorCloseOrError, { passive: true })

      const onClean = () => {
        tor.events.off("close", onTorCloseOrError)
        tor.events.off("error", onTorCloseOrError)
      }

      return new Ok(new Cleanable(tor, onClean))
    })
  }, { capacity, signal })

  return new Mutex(pool)
}