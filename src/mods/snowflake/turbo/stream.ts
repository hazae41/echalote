import { Opaque, Writable } from "@hazae41/binary"
import { Bytes } from "@hazae41/bytes"
import { Catched, Ok } from "@hazae41/result"
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

  get readable() {
    return this.#secret.readable
  }

  get writable() {
    return this.#secret.writable
  }

}

export class SecretTurboDuplex {
  readonly #class = SecretTurboDuplex

  static readonly token = new Uint8Array([0x12, 0x93, 0x60, 0x5d, 0x27, 0x81, 0x75, 0xf5])

  readonly reader: SecretTurboReader
  readonly writer: SecretTurboWriter

  readonly readable: ReadableStream<Opaque>
  readonly writable: WritableStream<Writable>

  readonly clientID: Uint8Array

  constructor(
    readonly stream: ReadableWritablePair<Opaque, Writable>,
    readonly params: TurboDuplexParams = {}
  ) {
    const { clientID } = params

    this.clientID = clientID ?? Bytes.tryRandom(8).unwrap()

    this.reader = new SecretTurboReader(this)
    this.writer = new SecretTurboWriter(this)

    const read = this.reader.stream.start()
    const write = this.writer.stream.start()

    this.readable = read.readable
    this.writable = write.writable

    stream.readable
      .pipeTo(read.writable)
      .then(this.#onReadClose.bind(this))
      .catch(this.#onReadError.bind(this))
      .then(r => r.ignore())
      .catch(console.error)

    write.readable
      .pipeTo(stream.writable)
      .then(this.#onWriteClose.bind(this))
      .catch(this.#onWriteError.bind(this))
      .then(r => r.ignore())
      .catch(console.error)
  }

  get class() {
    return this.#class
  }

  async #onReadClose() {
    Console.debug(`${this.#class.name}.onReadClose`)

    this.reader.stream.closed = {}

    await this.reader.events.emit("close", [undefined])

    return Ok.void()
  }


  async #onWriteClose() {
    Console.debug(`${this.#class.name}.onWriteClose`)

    this.writer.stream.closed = {}

    await this.writer.events.emit("close", [undefined])

    return Ok.void()
  }

  async #onReadError(reason?: unknown) {
    Console.debug(`${this.#class.name}.onReadError`, { reason })

    this.reader.stream.closed = { reason }
    this.writer.stream.error(reason)

    await this.reader.events.emit("error", [reason])

    return Catched.throwOrErr(reason)
  }

  async #onWriteError(reason?: unknown) {
    Console.debug(`${this.#class.name}.onWriteError`, { reason })

    this.writer.stream.closed = { reason }
    this.reader.stream.error(reason)

    await this.writer.events.emit("error", [reason])

    return Catched.throwOrErr(reason)
  }

}