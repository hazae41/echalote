import { Bytes } from "@hazae41/bytes"
import { BigInts } from "libs/bigint/bigint.js"

export class AesCounter {

  readonly #key: CryptoKey

  index = 0
  counter: bigint
  #length: number

  constructor(key: CryptoKey, counter: bigint, length = 128) {
    this.#key = key
    this.counter = counter
    this.#length = length
  }

  static async from(raw: Uint8Array, counter: bigint, length?: number) {
    const key = await crypto.subtle.importKey("raw", raw, { name: "AES-CTR" }, false, ["encrypt", "decrypt"])

    return new this(key, counter, length)
  }

  async encrypt(data: Uint8Array) {
    const counter0 = BigInts.tryExport(this.counter).unwrap()
    const counter = Bytes.tryPadStart(counter0, 16).unwrap()
    const result = await crypto.subtle.encrypt({ name: "AES-CTR", counter, length: 128 }, this.#key, data)
    console.log(data.length / 16)
    this.counter += BigInt(Math.floor(data.length / 16))
    return result
  }

  async decrypt(data: Uint8Array) {
    const counter0 = BigInts.tryExport(this.counter).unwrap()
    const counter = Bytes.tryPadStart(counter0, 16).unwrap()
    const result = await crypto.subtle.decrypt({ name: "AES-CTR", counter, length: 128 }, this.#key, data)
    this.counter += BigInt(Math.floor(data.length / 16))
    return result
  }

}