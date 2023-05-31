import { Mutex } from "@hazae41/mutex";
import { Pool, PoolParams } from "@hazae41/piscine";
import { Ok, Result } from "@hazae41/result";
import { AbortSignals } from "libs/signals/signals.js";
import { Circuit } from "mods/tor/circuit.js";
import { TorClientDuplex } from "mods/tor/tor.js";

export function createCircuitPool(tor: TorClientDuplex, params: PoolParams = {}) {
  const pool = new Pool<Circuit>(async ({ pool, signal }) => {
    return await Result.unthrow(async t => {
      const circuit = await tor.tryCreateAndExtendLoop(signal).then(r => r.throw(t))

      const onCircuitCloseOrError = async () => {
        circuit.events.off("close", onCircuitCloseOrError)
        circuit.events.off("error", onCircuitCloseOrError)

        pool.delete(circuit)

        return Ok.void()
      }

      circuit.events.on("close", onCircuitCloseOrError, { passive: true })
      circuit.events.on("error", onCircuitCloseOrError, { passive: true })

      return new Ok(circuit)
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
        circuit.events.off("close", onCircuitCloseOrError)
        circuit.events.off("error", onCircuitCloseOrError)

        pool.delete(circuit)

        return Ok.void()
      }

      circuit.events.on("close", onCircuitCloseOrError, { passive: true })
      circuit.events.on("error", onCircuitCloseOrError, { passive: true })

      return new Ok(circuit)
    })
  }, { capacity, signal })

  pool.signal.addEventListener("abort", async (reason) => {
    tors.inner.abort(reason)

    return Ok.void()
  }, { passive: true, once: true })

  return new Mutex(pool)
}