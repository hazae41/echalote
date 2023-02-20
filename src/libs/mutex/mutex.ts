export class Mutex {

  #promise?: Promise<unknown>

  /**
   * Lock this mutex
   * @param callback 
   * @returns 
   */
  async lock<T>(callback: () => Promise<T>) {
    if (this.#promise)
      await this.#promise

    const promise = callback()
    this.#promise = promise

    return await promise
  }

  get promise() {
    return this.#promise
  }

}