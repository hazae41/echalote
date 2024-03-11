import { Opaque, Writable } from "@hazae41/binary"
import { Bytes } from "@hazae41/bytes"
import { CloseEvents, ErrorEvents, FullDuplex } from "@hazae41/cascade"
import { SuperEventTarget } from "@hazae41/plume"
import { SecretTurboReader } from "./reader.js"
import { SecretTurboWriter } from "./writer.js"

export interface TurboDuplexParams {
  readonly client?: Uint8Array
}

export type TurboDuplexEvents =
  & CloseEvents
  & ErrorEvents

export class TurboDuplex {

  readonly #secret: SecretTurboDuplex

  readonly events = new SuperEventTarget<TurboDuplexEvents>()

  constructor(
    readonly params: TurboDuplexParams = {}
  ) {
    this.#secret = new SecretTurboDuplex(params)

    this.#secret.events.on("close", () => this.events.emit("close"))
    this.#secret.events.on("error", e => this.events.emit("error", e))
  }

  [Symbol.dispose]() {
    this.close().catch(console.error)
  }

  async [Symbol.asyncDispose]() {
    await this.close()
  }

  get client() {
    return this.#secret.client
  }

  get inner() {
    return this.#secret.inner
  }

  get outer() {
    return this.#secret.outer
  }

  get closing() {
    return this.#secret.closing
  }

  get closed() {
    return this.#secret.closed
  }

  async error(reason?: unknown) {
    await this.#secret.error(reason)
  }

  async close() {
    await this.#secret.close()
  }

}

export type SecretTurboDuplexEvents =
  & CloseEvents
  & ErrorEvents

export class SecretTurboDuplex {
  readonly #class = SecretTurboDuplex

  static readonly token = new Uint8Array([0x12, 0x93, 0x60, 0x5d, 0x27, 0x81, 0x75, 0xf5])

  readonly duplex = new FullDuplex<Opaque, Writable>()
  readonly events = new SuperEventTarget<SecretTurboDuplexEvents>()

  readonly reader: SecretTurboReader
  readonly writer: SecretTurboWriter

  readonly client: Uint8Array

  constructor(
    readonly params: TurboDuplexParams = {}
  ) {
    this.duplex.events.on("close", () => this.events.emit("close"))
    this.duplex.events.on("error", e => this.events.emit("error", e))

    const { client = Bytes.random(8) } = params

    this.client = client

    this.reader = new SecretTurboReader(this)
    this.writer = new SecretTurboWriter(this)
  }

  get class() {
    return this.#class
  }

  [Symbol.dispose]() {
    this.close().catch(console.error)
  }

  async [Symbol.asyncDispose]() {
    await this.close()
  }

  get inner() {
    return this.duplex.inner
  }

  get outer() {
    return this.duplex.outer
  }

  get input() {
    return this.duplex.input
  }

  get output() {
    return this.duplex.output
  }

  get closing() {
    return this.duplex.closing
  }

  get closed() {
    return this.duplex.closed
  }

  async error(reason?: unknown) {
    await this.duplex.error(reason)
  }

  async close() {
    await this.duplex.close()
  }

}