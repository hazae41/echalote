import { Pool, PoolParams } from "@hazae41/piscine";
import { Ok } from "@hazae41/result";
import { AbortSignals } from "libs/signals/signals.js";
import { Circuit } from "mods/tor/circuit.js";
import { TorClientDuplex } from "mods/tor/tor.js";

export function createCircuitPool(tor: TorClientDuplex, params: PoolParams = {}) {
  return new Pool<Circuit>(async ({ pool, index, signal }) => {
    console.log("pool", index)

    const signal2 = AbortSignals.timeout(5_000, signal)
    await tor.tryWait(signal2).then(r => r.unwrap())

    const circuit = await tor.tryCreateAndExtendLoop(signal).then(r => r.mapErrSync(console.warn).unwrap())

    const onCircuitCloseOrError = () => {
      circuit.events.off("close", onCircuitCloseOrError)
      circuit.events.off("error", onCircuitCloseOrError)

      pool.delete(circuit)

      return Ok.void()
    }

    circuit.events.on("close", onCircuitCloseOrError)
    circuit.events.on("error", onCircuitCloseOrError)

    return circuit
  }, params)
}
