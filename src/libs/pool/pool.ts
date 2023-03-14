import { Arrays } from "@hazae41/arrays";
import { AsyncEventTarget } from "libs/events/target.js";

export interface PoolParams {
  readonly capacity?: number
  readonly signal?: AbortSignal
}

export interface PoolCreatorParams {
  readonly index: number
  readonly signal?: AbortSignal

  destroy(): void
}

export type PoolCreator<T> =
  (params: PoolCreatorParams) => Promise<T>

export interface PoolEntry<T> {
  readonly index: number,
  readonly element: T
}

export type PoolEvents<T> = {
  element: MessageEvent<PoolEntry<T>>
}

export class Pool<T> {

  readonly events = new AsyncEventTarget<PoolEvents<T>>()

  readonly capacity: number

  readonly #allElements: T[]
  readonly #allPromises: Promise<T>[]

  readonly #openElements = new Set<T>()

  /**
   * A pool of circuits
   * @param tor 
   * @param params 
   */
  constructor(
    readonly create: PoolCreator<T>,
    readonly params: PoolParams = {}
  ) {
    const { capacity = 3 } = params

    this.capacity = capacity

    this.#allElements = new Array(capacity)
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

    const destroy = () => {
      delete this.#allElements[index]
      this.#openElements.delete(element)

      this.#start(index)
    }

    const element = await this.create({ index, signal, destroy })

    this.#allElements[index] = element
    this.#openElements.add(element)

    const event = new MessageEvent("element", { data: { index, element } })
    this.events.dispatchEvent(event, "element").catch(console.warn)

    return element
  }

  /**
   * Number of open circuits
   */
  get size() {
    return this.#openElements.size
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
    return this.#allElements.at(index)
  }

  /**
   * Iterator on open circuits
   * @returns 
   */
  [Symbol.iterator]() {
    return this.#openElements.values()
  }

  /**
   * Wait for any circuit to be created, then get a random one
   * @returns 
   */
  async random() {
    await Promise.any(this.#allPromises)

    return this.randomSync()
  }

  /**
   * Get a random circuit from the pool, throws if none available
   * @returns 
   */
  randomSync() {
    const circuits = [...this.#openElements]
    const circuit = Arrays.cryptoRandom(circuits)

    if (!circuit)
      throw new Error(`No circuit in pool`)

    return circuit
  }

}