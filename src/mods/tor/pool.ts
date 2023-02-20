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

  get circuits() {
    return this.#circuits as readonly Circuit[]
  }

  get promises() {
    return this.#promises as readonly Promise<void>[]
  }

  #start(index: number, signal?: AbortSignal) {
    if (this.#promises.at(index))
      return
    if (this.#circuits.at(index))
      return
    this.#promises[index] = this.#create(index, signal).catch(console.warn)
  }

  async #create(index: number, signal?: AbortSignal) {
    if (signal?.aborted)
      throw new Error(`Aborted`)

    const onError = () => {
      delete this.#circuits[index]
      delete this.#promises[index]
      this.#start(index)
    }

    const circuit = await this.tor.tryCreateAndExtend({ signal })
    circuit.addEventListener("error", onError)
    this.#circuits[index] = circuit
  }

  /**
   * Wait for any circuit to be created, then get a random one
   * @returns 
   */
  async get() {
    await Promise.any(this.#promises)
    return this.getSync()
  }

  /**
   * Get a random circuit from the pool
   * @returns 
   */
  getSync() {
    const circuits = this.#circuits.filter(Boolean)
    const circuit = Arrays.randomOf(circuits)

    if (!circuit)
      throw new Error(`No circuit in pool`)

    return circuit
  }

}