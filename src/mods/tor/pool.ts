import { Arrays } from "libs/arrays/arrays.js";
import { Circuit } from "mods/tor/circuit.js";
import { Tor } from "mods/tor/tor.js";

export interface CircuitPoolParams {
  readonly count: number
}

export class CircuitPool {

  #circuits = new Array<Circuit>()

  constructor(
    readonly tor: Tor,
    readonly params: CircuitPoolParams
  ) {
    this.create()
  }

  #creating?: Promise<void>

  async create() {
    if (!this.#creating)
      this.#creating = this.#create()
    return await this.#creating
  }

  async #create() {
    const { count } = this.params

    const onError = (circuit: Circuit) => {
      this.#circuits = this.#circuits.filter(it => it !== circuit)
      this.create()
    }

    while (this.#circuits.length < count) {
      const circuit = await this.tor.tryCreateAndExtend()
      circuit.addEventListener("error", () => onError(circuit))
      this.#circuits.push(circuit)
    }
  }

  async fetch(input: RequestInfo, init: RequestInit = {}) {
    const circuit = Arrays.randomOf(this.#circuits)

    if (!circuit)
      throw new Error(`No circuit in pool`)

    return await circuit.fetch(input, init)
  }
}