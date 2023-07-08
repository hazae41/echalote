import { Cleaner } from "@hazae41/cleaner";
import { None } from "@hazae41/option";
import { PoolCreatorParams } from "@hazae41/piscine";
import { Circuit } from "mods/tor/circuit.js";
import { TorClientDuplex } from "mods/tor/tor.js";

export function createPooledCircuit<PoolError>(circuit: Circuit, params: PoolCreatorParams<Circuit, PoolError>) {
  const { pool, index } = params

  const onCloseOrError = async (reason?: unknown) => {
    pool.delete(index)
    return new None()
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
    return new None()
  }

  tor.events.on("close", onCloseOrError, { passive: true })
  tor.events.on("error", onCloseOrError, { passive: true })

  const onClean = () => {
    tor.events.off("close", onCloseOrError)
    tor.events.off("error", onCloseOrError)
  }

  return new Cleaner(tor, onClean)
}