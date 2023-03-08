import { Arrays } from "@hazae41/arrays";
import { AsyncEventTarget } from "libs/events/target.js";
import { Circuit } from "mods/tor/circuit.js";
import { TorClientDuplex } from "mods/tor/tor.js";

export interface CircuitPoolParams {
  readonly capacity?: number
  readonly signal?: AbortSignal
}

export interface CircuitPoolEntry {
  readonly index: number,
  readonly circuit: Circuit
}

export type CircuitPoolEvents = {
  circuit: MessageEvent<CircuitPoolEntry>
}

export class CircuitPool {

  readonly events = new AsyncEventTarget<CircuitPoolEvents>()

  readonly capacity: number

  readonly #allCircuits: Circuit[]
  readonly #allPromises: Promise<Circuit>[]

  readonly #openCircuits = new Set<Circuit>()

  /**
   * A pool of circuits
   * @param tor 
   * @param params 
   */
  constructor(
    readonly tor: TorClientDuplex,
    readonly params: CircuitPoolParams = {}
  ) {
    const { capacity = 3 } = this.params

    this.capacity = capacity

    this.#allCircuits = new Array(capacity)
    this.#allPromises = new Array(capacity)

    for (let index = 0; index < capacity; index++)
      this.#start(index)
  }

  #start(index: number) {
    const promise = this.#create(index)
    this.#allPromises[index] = promise
    promise.catch(console.warn)
  }

  async #create(index: number) {
    const { signal } = this.params

    const circuit = await this.tor.tryCreateAndExtend({ signal })

    this.#allCircuits[index] = circuit
    this.#openCircuits.add(circuit)

    const onCircuitCloseOrError = () => {
      delete this.#allCircuits[index]
      this.#openCircuits.delete(circuit)

      circuit.events.removeEventListener("close", onCircuitCloseOrError)
      circuit.events.removeEventListener("error", onCircuitCloseOrError)

      this.#start(index)
    }

    circuit.events.addEventListener("close", onCircuitCloseOrError)
    circuit.events.addEventListener("error", onCircuitCloseOrError)

    const event = new MessageEvent("circuit", { data: { index, circuit } })
    this.events.dispatchEvent(event, "circuit").catch(console.warn)

    return circuit
  }

  /**
   * Number of open circuits
   */
  get size() {
    return this.#openCircuits.size
  }

  /**
   * Get the circuit promise at index
   * @param index 
   * @returns 
   */
  async get(index: number) {
    return this.#allPromises[index]
  }

  /**
   * Get the circuit (or undefined) at index
   * @param index 
   * @returns 
   */
  getSync(index: number) {
    return this.#allCircuits.at(index)
  }

  /**
   * Iterator on open circuits
   * @returns 
   */
  [Symbol.iterator]() {
    return this.#openCircuits.values()
  }

  /**
   * Wait for any circuit to be created, then get a random one
   * @returns 
   */
  async cryptoRandom() {
    await Promise.any(this.#allPromises)

    return this.cryptoRandomSync()
  }

  /**
   * Get a random circuit from the pool, throws if none available
   * @returns 
   */
  cryptoRandomSync() {
    const circuits = [...this.#openCircuits]
    const circuit = Arrays.cryptoRandom(circuits)

    if (!circuit)
      throw new Error(`No circuit in pool`)

    return circuit
  }

}