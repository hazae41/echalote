import { Opaque, Writable } from "@hazae41/binary"
import { Bytes } from "@hazae41/bytes"
import { SecretTurboReader } from "./reader.js"
import { SecretTurboWriter } from "./writer.js"

export interface TurboStreamParams {
  clientID?: Uint8Array
}

export class TurboStream {

  readonly #secret: SecretTurboStream

  constructor(
    readonly stream: ReadableWritablePair<Uint8Array, Uint8Array>,
    readonly params: TurboStreamParams = {}
  ) {
    this.#secret = new SecretTurboStream(stream, params)
  }

  get readable() {
    return this.#secret.readable
  }

  get writable() {
    return this.#secret.writable
  }

}

export class SecretTurboStream {
  readonly #class = SecretTurboStream

  static readonly token = new Uint8Array([0x12, 0x93, 0x60, 0x5d, 0x27, 0x81, 0x75, 0xf5])

  readonly reader: SecretTurboReader
  readonly writer: SecretTurboWriter

  readonly readable: ReadableStream<Opaque>
  readonly writable: WritableStream<Writable>

  readonly clientID: Uint8Array

  constructor(
    readonly stream: ReadableWritablePair<Uint8Array, Uint8Array>,
    readonly params: TurboStreamParams = {}
  ) {
    const { clientID } = params

    this.clientID = clientID ?? Bytes.random(8)

    this.reader = new SecretTurboReader(this)
    this.writer = new SecretTurboWriter(this)

    const read = this.reader.stream.create()
    const write = this.writer.stream.create()

    this.readable = read.readable
    this.writable = write.writable

    stream.readable
      .pipeTo(read.writable)
      .then(this.#onReadClose.bind(this))
      .catch(this.#onReadError.bind(this))

    write.readable
      .pipeTo(stream.writable)
      .then(this.#onWriteClose.bind(this))
      .catch(this.#onWriteError.bind(this))
  }

  get class() {
    return this.#class
  }

  async #onReadClose() {
    console.debug(`${this.#class.name}.onReadClose`)

    this.reader.stream.close()
    this.writer.stream.error()

    const closeEvent = new CloseEvent("close", {})
    await this.reader.dispatchEvent(closeEvent)
  }

  async #onReadError(reason?: unknown) {
    console.debug(`${this.#class.name}.onReadError`, reason)

    this.reader.stream.close(reason)
    this.writer.stream.error(reason)

    const error = new Error(`Errored`, { cause: reason })
    const errorEvent = new ErrorEvent("error", { error })
    await this.reader.dispatchEvent(errorEvent)
  }

  async #onWriteClose() {
    console.debug(`${this.#class.name}.onWriteClose`)

    this.writer.stream.close()
    this.reader.stream.error()

    const closeEvent = new CloseEvent("close", {})
    await this.writer.dispatchEvent(closeEvent)
  }

  async #onWriteError(reason?: unknown) {
    console.debug(`${this.#class.name}.onWriteError`, reason)

    this.writer.stream.close(reason)
    this.reader.stream.error(reason)

    const error = new Error(`Errored`, { cause: reason })
    const errorEvent = new ErrorEvent("error", { error })
    await this.writer.dispatchEvent(errorEvent)
  }

}