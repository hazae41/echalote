import { TorClientDuplex, TorClientParams, createWebSocketSnowflakeStream } from "@hazae41/echalote";
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