import { Pool } from "@hazae41/piscine";

export class SizedPool<T, N extends number = number> {

  private constructor(
    readonly pool: Pool<T>,
    readonly size: N,
  ) { }

  static start<T, N extends number>(pool: Pool<T>, size: N) {
    for (let i = 0; i < size; i++)
      pool.start(i)
    return new SizedPool(pool, size)
  }

}