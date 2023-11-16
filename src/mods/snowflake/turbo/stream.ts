import { Opaque, Writable } from "@hazae41/binary"
import { Bytes } from "@hazae41/bytes"
import { Console } from "mods/console/index.js"
import { SecretTurboReader } from "./reader.js"
import { SecretTurboWriter } from "./writer.js"

export interface TurboDuplexParams {
  clientID?: Uint8Array
}

export class TurboDuplex {

  readonly #secret: SecretTurboDuplex

  constructor(
    readonly stream: ReadableWritablePair<Opaque, Writable>,
    readonly params: TurboDuplexParams = {}
  ) {
    this.#secret = new SecretTurboDuplex(stream, params)
  }

  get inner() {
    return this.#secret.inner
  }

  get outer() {
    return this.#secret.outer
  }

}

export class SecretTurboDuplex {
  readonly #class = SecretTurboDuplex

  static readonly token = new Uint8Array([0x12, 0x93, 0x60, 0x5d, 0x27, 0x81, 0x75, 0xf5])

  readonly reader: SecretTurboReader
  readonly writer: SecretTurboWriter

  readonly inner: ReadableWritablePair<Writable, Opaque>
  readonly outer: ReadableWritablePair<Opaque, Writable>

  readonly clientID: Uint8Array

  constructor(
    readonly stream: ReadableWritablePair<Opaque, Writable>,
    readonly params: TurboDuplexParams = {}
  ) {
    const { clientID = Bytes.random(8) } = params

    this.clientID = clientID

    this.reader = new SecretTurboReader(this)
    this.writer = new SecretTurboWriter(this)

    const preInputer = this.reader.stream.start()
    const preOutputer = this.writer.stream.start()

    const postInputer = new TransformStream<Opaque, Opaque>({})
    const postOutputer = new TransformStream<Writable, Writable>({})

    /**
     * Inner protocol (UDP?)
     */
    this.inner = {
      readable: postOutputer.readable,
      writable: preInputer.writable
    }

    /**
     * Outer protocol (SMUX?)
     */
    this.outer = {
      readable: postInputer.readable,
      writable: preOutputer.writable
    }

    preInputer.readable
      .pipeTo(postInputer.writable)
      .then(() => this.#onInputClose())
      .catch(e => this.#onInputError(e))
      .catch(() => { })

    preOutputer.readable
      .pipeTo(postOutputer.writable)
      .then(() => this.#onOutputClose())
      .catch(e => this.#onOutputError(e))
      .catch(() => { })
  }

  get class() {
    return this.#class
  }

  async #onInputClose() {
    Console.debug(`${this.#class.name}.onReadClose`)

    this.reader.stream.closed = {}

    await this.reader.events.emit("close", [undefined])
  }


  async #onOutputClose() {
    Console.debug(`${this.#class.name}.onWriteClose`)

    this.writer.stream.closed = {}

    await this.writer.events.emit("close", [undefined])
  }

  async #onInputError(reason?: unknown) {
    Console.debug(`${this.#class.name}.onReadError`, { reason })

    this.reader.stream.closed = { reason }
    this.writer.stream.error(reason)

    await this.reader.events.emit("error", [reason])
  }

  async #onOutputError(reason?: unknown) {
    Console.debug(`${this.#class.name}.onWriteError`, { reason })

    this.writer.stream.closed = { reason }
    this.reader.stream.error(reason)

    await this.writer.events.emit("error", [reason])
  }

}