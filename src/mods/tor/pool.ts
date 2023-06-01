import { Mutex } from "@hazae41/mutex";
import { Pool, PoolParams } from "@hazae41/piscine";
import { Cleanable } from "@hazae41/plume";
import { Ok, Result } from "@hazae41/result";
import { AbortSignals } from "libs/signals/signals.js";
import { Circuit } from "mods/tor/circuit.js";
import { TorClientDuplex } from "mods/tor/tor.js";

export function createCircuitPool(tor: TorClientDuplex, params: PoolParams = {}) {
  const pool = new Pool<Circuit>(async ({ pool, index, signal }) => {
    return await Result.unthrow(async t => {
      const circuit = await tor.tryCreateAndExtendLoop(signal).then(r => r.throw(t))

      const onCircuitCloseOrError = async () => {
        pool.delete(index)
        return Ok.void()
      }

      circuit.events.on("close", onCircuitCloseOrError, { passive: true })
      circuit.events.on("error", onCircuitCloseOrError, { passive: true })

      const onClean = () => {
        circuit.events.off("close", onCircuitCloseOrError)
        circuit.events.off("error", onCircuitCloseOrError)
      }

      return new Ok(new Cleanable(circuit, onClean))
    })
  }, params)

  return new Mutex(pool)
}


export function createCircuitPoolFromTorPool(tors: Mutex<Pool<TorClientDuplex>>, params: PoolParams = {}) {
  const { capacity } = params

  const signal = AbortSignals.merge(tors.inner.signal, params.signal)

  const pool = new Pool<Circuit>(async ({ pool, index, signal }) => {
    return await Result.unthrow(async t => {
      const tor = await tors.inner.tryGet(index % tors.inner.capacity).then(r => r.throw(t))
      const circuit = await tor.tryCreateAndExtendLoop(signal).then(r => r.throw(t))

      const onCircuitCloseOrError = async () => {
        pool.delete(index)
        return Ok.void()
      }

      circuit.events.on("close", onCircuitCloseOrError, { passive: true })
      circuit.events.on("error", onCircuitCloseOrError, { passive: true })

      const onClean = () => {
        circuit.events.off("close", onCircuitCloseOrError)
        circuit.events.off("error", onCircuitCloseOrError)
      }

      return new Ok(new Cleanable(circuit, onClean))
    })
  }, { capacity, signal })

  pool.signal.addEventListener("abort", async (reason) => {
    tors.inner.abort(reason)

    return Ok.void()
  }, { passive: true, once: true })

  return new Mutex(pool)
}