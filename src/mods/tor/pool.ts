import { Pool, PoolParams } from "@hazae41/piscine";
import { Circuit } from "mods/tor/circuit.js";
import { TorClientDuplex } from "mods/tor/tor.js";

export function createCircuitPool(tor: TorClientDuplex, params: PoolParams = {}) {
  return new Pool<Circuit>(async ({ pool, signal }) => {
    const circuit = await tor.tryCreateAndExtend({ signal })

    const onCircuitCloseOrError = () => {
      circuit.events.removeEventListener("close", onCircuitCloseOrError)
      circuit.events.removeEventListener("error", onCircuitCloseOrError)

      pool.delete(circuit)
    }

    circuit.events.addEventListener("close", onCircuitCloseOrError)
    circuit.events.addEventListener("error", onCircuitCloseOrError)

    return circuit
  }, params)
}
