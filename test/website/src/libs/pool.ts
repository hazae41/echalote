import { Box } from "@hazae41/box";
import { Disposer } from "@hazae41/disposer";
import { Circuit, TorClientDuplex } from "@hazae41/echalote";
import { None } from "@hazae41/option";
import { PoolCreatorParams } from "@hazae41/piscine";

export function createCircuitEntry(circuit: Box<Circuit>, params: PoolCreatorParams<Circuit>) {
  const { pool, index } = params

  const onCloseOrError = async (reason?: unknown) => {
    pool.restart(index)
    return new None()
  }

  circuit.inner.events.on("close", onCloseOrError, { passive: true })
  circuit.inner.events.on("error", onCloseOrError, { passive: true })

  const onEntryClean = () => {
    using postcircuit = circuit

    circuit.inner.events.off("close", onCloseOrError)
    circuit.inner.events.off("error", onCloseOrError)
  }

  return new Disposer(circuit, onEntryClean)
}

export function createTorEntry(tor: Box<TorClientDuplex>, params: PoolCreatorParams<TorClientDuplex>) {
  const { pool, index } = params

  const onCloseOrError = async (reason?: unknown) => {
    pool.restart(index)
    return new None()
  }

  tor.inner.events.on("close", onCloseOrError, { passive: true })
  tor.inner.events.on("error", onCloseOrError, { passive: true })

  const onClean = () => {
    using posttor = tor

    tor.inner.events.off("close", onCloseOrError)
    tor.inner.events.off("error", onCloseOrError)
  }

  return new Disposer(tor, onClean)
}