import { TorClientDuplex, TorClientParams, createWebSocketSnowflakeStream } from "@hazae41/echalote";
import { Mutex } from "@hazae41/mutex";
import { Pool, PoolParams } from "@hazae41/piscine";
import { AbortError } from "@hazae41/plume";
import { Err, Ok, Result } from "@hazae41/result";

export async function tryCreateTorLoop(params: TorClientParams): Promise<Result<TorClientDuplex, AbortError>> {
  const { signal, fallbacks, ed25519, x25519, sha1 } = params

  while (!signal?.aborted) {
    const tcp = await createWebSocketSnowflakeStream("wss://snowflake.torproject.net/")
    const tor = new TorClientDuplex(tcp, { fallbacks, ed25519, x25519, sha1, signal })

    const result = await tor.tryWait().then(r => r.ignore())

    if (result.isOk())
      return new Ok(tor)

    console.warn(`Tor creation failed`, { error: result.get() })
    continue
  }

  return new Err(AbortError.from(signal.reason))
}

export function createTorPool(params: TorClientParams & PoolParams) {
  const { fallbacks, ed25519, x25519, sha1, capacity, signal } = params

  const pool = new Pool<TorClientDuplex>(async ({ pool, signal }) => {
    return await Result.unthrow(async t => {
      const tor = await tryCreateTorLoop({ fallbacks, ed25519, x25519, sha1, signal }).then(r => r.throw(t))

      const onTorCloseOrError = async (reason?: unknown) => {
        tor.events.off("close", onTorCloseOrError)
        tor.events.off("error", onTorCloseOrError)

        pool.delete(tor)

        return Ok.void()
      }

      tor.events.on("close", onTorCloseOrError, { passive: true })
      tor.events.on("error", onTorCloseOrError, { passive: true })

      return new Ok(tor)
    })
  }, { capacity, signal })

  return new Mutex(pool)
}