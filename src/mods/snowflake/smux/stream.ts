import { Cursor } from "@hazae41/binary"
import { AsyncEventTarget } from "libs/events/target.js"
import { SecretSmuxReader } from "./reader.js"
import { SecretSmuxWriter } from "./writer.js"

export class SecretSmuxStream extends AsyncEventTarget {

  selfRead = 0
  selfWrite = 0
  selfIncrement = 0

  peerConsumed = 0
  peerWindow = 65535

  readonly reader = new SecretSmuxReader(this)
  readonly writer = new SecretSmuxWriter(this)

  readonly buffer = Cursor.allocUnsafe(65535)

  constructor(
    readonly overt: SmuxStream
  ) {
    super()
  }

  get selfWindow() {
    return this.buffer.bytes.length
  }

}

export class SmuxStream {
  readonly #class = SmuxStream

  readonly #secret: SecretSmuxStream

  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<Uint8Array>

  constructor(
    readonly stream: ReadableWritablePair<Uint8Array>
  ) {
    this.#secret = new SecretSmuxStream(this)

    this.readable = this.#secret.reader.pair.readable
    this.writable = this.#secret.writer.pair.writable

    stream.readable
      .pipeTo(this.#secret.reader.pair.writable)
      .then(this.onReadClose.bind(this))
      .catch(this.onReadError.bind(this))

    this.#secret.writer.pair.readable
      .pipeTo(stream.writable)
      .then(this.onWriteClose.bind(this))
      .catch(this.onWriteError.bind(this))
  }

  get reader() {
    return this.#secret.reader.overt
  }

  get writer() {
    return this.#secret.writer.overt
  }

  async onReadClose() {
    const closeEvent = new CloseEvent("close", {})
    await this.reader.dispatchEvent(closeEvent)
  }

  async onReadError(error?: unknown) {
    console.debug(`${this.#class.name}.onReadError`, error)

    const errorEvent = new ErrorEvent("error", { error })
    await this.reader.dispatchEvent(errorEvent)
  }

  async onWriteClose() {
    const closeEvent = new CloseEvent("close", {})
    await this.writer.dispatchEvent(closeEvent)
  }

  async onWriteError(error?: unknown) {
    console.debug(`${this.#class.name}.onWriteError`, error)

    const errorEvent = new ErrorEvent("error", { error })
    await this.writer.dispatchEvent(errorEvent)
  }

}