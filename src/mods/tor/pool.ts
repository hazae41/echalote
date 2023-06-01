import { Cleaner } from "@hazae41/cleaner";
import { PoolCreatorParams } from "@hazae41/piscine";
import { AbortError } from "@hazae41/plume";
import { Err, Ok, Result } from "@hazae41/result";
import { Circuit } from "mods/tor/circuit.js";
import { TorClientDuplex } from "mods/tor/tor.js";
import { TooManyRetriesError } from "./errors.js";

export type Creator<CreateOutput, CreateError> =
  (params: PoolCreatorParams<any, any>) => Promise<Result<CreateOutput, CreateError>>

export async function tryCreateLoop<CreateOutput, CreateError>(tryCreate: Creator<CreateOutput, CreateError>, params: PoolCreatorParams<any, any>): Promise<Result<CreateOutput, CreateError | AbortError | TooManyRetriesError>> {
  const { signal } = params

  for (let i = 0; !signal?.aborted && i < 3; i++) {
    const result = await tryCreate(params)

    if (result.isOk())
      return result

    console.warn(`tryCreate failed ${i + 1} time(s)`, { error: result.get() })
    await new Promise(ok => setTimeout(ok, 1000 * (2 ** i)))
    continue
  }

  if (signal?.aborted)
    return new Err(AbortError.from(signal.reason))
  return new Err(new TooManyRetriesError())
}

export function createPooledCircuit<PoolError>(circuit: Circuit, params: PoolCreatorParams<Circuit, PoolError>) {
  const { pool, index } = params

  const onCloseOrError = async () => {
    pool.delete(index)
    return Ok.void()
  }

  circuit.events.on("close", onCloseOrError, { passive: true })
  circuit.events.on("error", onCloseOrError, { passive: true })

  const onClean = () => {
    circuit.events.off("close", onCloseOrError)
    circuit.events.off("error", onCloseOrError)
  }

  return new Cleaner(circuit, onClean)
}

export function createPooledTor<PoolError>(tor: TorClientDuplex, params: PoolCreatorParams<TorClientDuplex, PoolError>) {
  const { pool, index } = params

  const onCloseOrError = async (reason?: unknown) => {
    pool.delete(index)
    return Ok.void()
  }

  tor.events.on("close", onCloseOrError, { passive: true })
  tor.events.on("error", onCloseOrError, { passive: true })

  const onClean = () => {
    tor.events.off("close", onCloseOrError)
    tor.events.off("error", onCloseOrError)
  }

  return new Cleaner(tor, onClean)
}