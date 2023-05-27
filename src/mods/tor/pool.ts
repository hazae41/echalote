import { Pool, PoolParams } from "@hazae41/piscine";
import { Ok } from "@hazae41/result";
import { Circuit } from "mods/tor/circuit.js";
import { TorClientDuplex } from "mods/tor/tor.js";

export function createCircuitPool(tor: TorClientDuplex, params: PoolParams = {}) {
  return new Pool<Circuit>(async ({ pool, signal }) => {
    const circuit = await tor.tryCreateAndExtendLoop(signal).then(r => r.unwrap())

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
