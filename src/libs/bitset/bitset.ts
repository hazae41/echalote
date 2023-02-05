export class Bitset {
  readonly #class = Bitset

  constructor(
    public value: number,
    public length: number
  ) { }

  unsigned() {
    return this.value >>> 0
  }

  get(index: number) {
    return (this.value & (1 << index)) >> index
  }

  not() {
    for (let i = 0; i < this.length; i++)
      this.value ^= (1 << i)
    return this
  }

  toggle(index: number) {
    this.value ^= (1 << index)

    return this
  }

  enable(index: number) {
    this.value |= (1 << index)

    return this
  }

  disable(index: number) {
    this.value &= ~(1 << index)

    return this
  }

  set(index: number, value: boolean) {
    if (value)
      return this.enable(index)
    else
      return this.disable(index)
  }

  first(count: number) {
    return this.value >> (this.length - count)
  }

  last(count: number) {
    return this.value & ((1 << count) - 1)
  }
}