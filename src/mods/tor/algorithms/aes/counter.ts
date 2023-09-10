
export class AesCounter {

  readonly #key: CryptoKey

  #counter: bigint
  #length: number

  constructor(key: CryptoKey, counter: bigint, length = 128) {
    this.#key = key
    this.#counter = counter
    this.#length = length
  }

  static async from(raw: Uint8Array, counter: bigint, length?: number) {
    const key = await crypto.subtle.importKey("raw", raw, { name: "AES-CTR" }, false, ["encrypt", "decrypt"])

    return new this(key, counter, length)
  }

  // async encrypt(data: Uint8Array) {
  //   const counter0 = Bytes.fromBigInt(this.#counter)
  //   const counter = Bytes.padStart(counter0, 16)
  //   const length = this.#length
  //   const result = await crypto.subtle.encrypt({ name: "AES-CTR", counter, length }, this.#key, data)
  //   this.#counter += BigInt(Math.ceil(data.length / 16))
  //   return result
  // }

  // async decrypt(data: Uint8Array) {
  //   const counter0 = Bytes.fromBigInt(this.#counter)
  //   const counter = Bytes.padStart(counter0, 16)
  //   const length = this.#length
  //   const result = await crypto.subtle.decrypt({ name: "AES-CTR", counter, length }, this.#key, data)
  //   this.#counter += BigInt(Math.ceil(data.length / 16))
  //   return result
  // }

}