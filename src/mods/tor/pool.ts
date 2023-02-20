import { Arrays } from "libs/arrays/arrays.js";
import { Circuit } from "mods/tor/circuit.js";
import { Tor } from "mods/tor/tor.js";

export interface CircuitPoolParams {
  readonly count: number
  readonly signal?: AbortSignal
}

export class CircuitPool {

  #circuits: Circuit[]
  #promises: Promise<void>[]

  constructor(
    readonly tor: Tor,
    readonly params: CircuitPoolParams
  ) {
    const { count, signal } = this.params

    this.#circuits = new Array<Circuit>(count)
    this.#promises = new Array<Promise<void>>(count)

    for (let index = 0; index < count; index++)
      this.#start(index, signal)
  }

  #start(index: number, signal?: AbortSignal) {
    this.#promises[index] = this.#create(index, signal).catch(console.error)
  }

  async #create(index: number, signal?: AbortSignal) {
    if (signal?.aborted)
      return
    if (this.#circuits.at(index))
      return
    if (this.#promises.at(index))
      return

    const onError = () => {
      delete this.#circuits[index]
      this.#start(index)
    }

    const circuit = await this.tor.tryCreateAndExtend({ signal })
    circuit.addEventListener("error", onError)
    this.#circuits[index] = circuit
  }

  get circuits() {
    return this.#circuits as readonly Circuit[]
  }

  /**
   * Get a random circuit from the pool
   * @returns 
   */
  get() {
    const circuit = Arrays.randomOf(this.#circuits)

    if (!circuit)
      throw new Error(`No circuit in pool`)

    return circuit
  }
}