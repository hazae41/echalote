export class Bitset {
  readonly #class = Bitset

  constructor(
    public value: number,
    public length: number
  ) { }

  /**
   * Get the value as unsigned 32-bit
   * 
   * @returns 
   */
  unsigned() {
    return this.value >>> 0
  }

  /**
   * Get the bit at big-endian index
   * 
   * @param index 
   * @returns 
   */
  get(index: number) {
    return Boolean(this.value & (1 << (this.length - index - 1)))
  }

  /**
   * Bitwise NOT
   * 
   * @returns 
   */
  not() {
    for (let i = 0; i < this.length; i++)
      this.value ^= (1 << i)
    return this
  }

  /**
   * Toggle the bit at big-endian index
   * 
   * @param index 
   * @returns 
   */
  toggle(index: number) {
    this.value ^= (1 << (this.length - index - 1))

    return this
  }

  /**
   * Enable the bit at big-endian index
   * 
   * @param index 
   * @returns 
   */
  enable(index: number) {
    this.value |= (1 << (this.length - index - 1))

    return this
  }

  /**
   * Disable the bit at big-endian index
   * 
   * @param index 
   * @returns 
   */
  disable(index: number) {
    this.value &= ~(1 << (this.length - index - 1))

    return this
  }

  /**
   * Set the bit at big-endian index
   * 
   * @param index 
   * @param value 
   * @returns 
   */
  set(index: number, value: boolean) {
    if (value)
      return this.enable(index)
    else
      return this.disable(index)
  }

  /**
   * Get first count bits
   * 
   * @param count number of bits to get
   * @returns 
   */
  first(count: number) {
    return this.value >> (this.length - count)
  }

  /**
   * Get last count bits
   * 
   * @param count number of bits to get
   * @returns 
   */
  last(count: number) {
    return this.value & ((1 << count) - 1)
  }
}