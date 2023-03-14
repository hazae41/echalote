import { Pool, PoolParams } from "libs/pool/pool.js";
import { Circuit } from "mods/tor/circuit.js";
import { TorClientDuplex } from "mods/tor/tor.js";

export function createCircuitPool(tor: TorClientDuplex, params: PoolParams = {}) {
  return new Pool<Circuit>(async ({ signal, destroy }) => {
    const circuit = await tor.tryCreateAndExtend({ signal })

    const onCircuitCloseOrError = () => {
      circuit.events.removeEventListener("close", onCircuitCloseOrError)
      circuit.events.removeEventListener("error", onCircuitCloseOrError)

      destroy()
    }

    circuit.events.addEventListener("close", onCircuitCloseOrError)
    circuit.events.addEventListener("error", onCircuitCloseOrError)

    return circuit
  }, params)
}
