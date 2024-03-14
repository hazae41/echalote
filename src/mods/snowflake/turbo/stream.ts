import { Opaque, Writable } from "@hazae41/binary"
import { Bytes } from "@hazae41/bytes"
import { FullDuplex } from "@hazae41/cascade"
import { Future } from "@hazae41/future"
import { Awaitable } from "libs/promises/index.js"
import { SecretTurboReader } from "./reader.js"
import { SecretTurboWriter } from "./writer.js"

export interface TurboDuplexParams {
  readonly client?: Uint8Array

  close?(this: undefined): Awaitable<void>
  error?(this: undefined, reason?: unknown): Awaitable<void>
}

export class TurboDuplex {

  readonly #secret: SecretTurboDuplex

  constructor(
    readonly params: TurboDuplexParams = {}
  ) {
    this.#secret = new SecretTurboDuplex(params)
  }

  [Symbol.dispose]() {
    this.close()
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

  error(reason?: unknown) {
    this.#secret.error(reason)
  }

  close() {
    this.#secret.close()
  }

}

export class SecretTurboDuplex {
  readonly #class = SecretTurboDuplex

  static readonly token = new Uint8Array([0x12, 0x93, 0x60, 0x5d, 0x27, 0x81, 0x75, 0xf5])

  readonly duplex: FullDuplex<Opaque, Writable>

  readonly reader: SecretTurboReader
  readonly writer: SecretTurboWriter

  readonly client: Uint8Array

  readonly resolveOnStart = new Future<void>()

  constructor(
    readonly params: TurboDuplexParams = {}
  ) {
    const { client = Bytes.random(8) } = params

    this.client = client

    this.reader = new SecretTurboReader(this)
    this.writer = new SecretTurboWriter(this)

    this.duplex = new FullDuplex<Opaque, Writable>({
      input: {
        write: c => this.reader.onWrite(c),
      },
      output: {
        start: () => this.writer.onStart(),
        write: c => this.writer.onWrite(c),
      },
      error: e => this.params.error?.call(undefined, e),
      close: () => this.params.close?.call(undefined),
    })

    this.resolveOnStart.resolve()
  }

  get class() {
    return this.#class
  }

  [Symbol.dispose]() {
    this.close()
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

  error(reason?: unknown) {
    this.duplex.error(reason)
  }

  close() {
    this.duplex.close()
  }

}