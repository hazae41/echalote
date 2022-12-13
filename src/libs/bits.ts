export class Bitmask {
  readonly #class = Bitmask

  constructor(
    public n: number
  ) { }

  get(i: number) {
    const mask = 1 << i
    const masked = this.n & mask
    return masked !== 0
  }

  set(i: number, x: boolean) {
    const mask = 1 << i

    if (x)
      this.n |= mask
    else
      this.n &= ~mask
    return this
  }

  export() {
    return this.n >>> 0
  }
}