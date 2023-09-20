import { Disposer } from "@hazae41/cleaner";
import { None } from "@hazae41/option";
import { PoolCreatorParams } from "@hazae41/piscine";
import { Circuit } from "mods/tor/circuit.js";
import { TorClientDuplex } from "mods/tor/tor.js";

export function createPooledCircuitDisposer(circuit: Circuit, params: PoolCreatorParams<any, any>) {
  const { pool, index } = params

  const onCloseOrError = async (reason?: unknown) => {
    await pool.restart(index)
    return new None()
  }

  circuit.events.on("close", onCloseOrError, { passive: true })
  circuit.events.on("error", onCloseOrError, { passive: true })

  const onClean = () => {
    circuit.events.off("close", onCloseOrError)
    circuit.events.off("error", onCloseOrError)
  }

  return new Disposer(circuit, onClean)
}

export function createPooledTorDisposer(tor: TorClientDuplex, params: PoolCreatorParams<any, any>) {
  const { pool, index } = params

  const onCloseOrError = async (reason?: unknown) => {
    await pool.restart(index)
    return new None()
  }

  tor.events.on("close", onCloseOrError, { passive: true })
  tor.events.on("error", onCloseOrError, { passive: true })

  const onClean = () => {
    tor.events.off("close", onCloseOrError)
    tor.events.off("error", onCloseOrError)
  }

  return new Disposer(tor, onClean)
}