import { Cursor, Empty, Opaque } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { Future } from "libs/futures/future.js";
import { StreamPair } from "libs/streams/pair.js";
import { KcpSegment } from "./segment.js";
import { SecretKcpStream } from "./stream.js";

export class KcpReader extends AsyncEventTarget<"close" | "error"> {

  readonly #secret: SecretKcpReader

  constructor(secret: SecretKcpReader) {
    super()

    this.#secret = secret
  }

  get stream() {
    return this.#secret.stream.overt
  }

  async wait<T extends Event>(event: never) {
    const future = new Future<Event, Error>()

    const onClose = (event: Event) => {
      const closeEvent = event as CloseEvent
      const error = new Error(`Closed`, { cause: closeEvent })
      future.err(error)
    }

    const onError = (event: Event) => {
      const errorEvent = event as ErrorEvent
      const error = new Error(`Errored`, { cause: errorEvent })
      future.err(error)
    }

    try {
      this.addEventListener("close", onClose, { passive: true })
      this.addEventListener("error", onError, { passive: true })
      this.addEventListener(event, future.ok, { passive: true })

      return await future.promise as T
    } finally {
      this.removeEventListener("close", onClose)
      this.removeEventListener("error", onError)
      this.removeEventListener(event, future.ok)
    }
  }

}

export class SecretKcpReader {

  readonly overt = new KcpReader(this)

  readonly pair: StreamPair<Opaque, Opaque>

  readonly #buffer = new Map<number, KcpSegment<Opaque>>()

  constructor(
    readonly stream: SecretKcpStream
  ) {
    this.pair = new StreamPair({}, {
      write: this.#onRead.bind(this)
    })
  }

  async #onRead(chunk: Opaque) {
    const cursor = new Cursor(chunk.bytes)

    while (cursor.remaining) {
      const segment = KcpSegment.tryRead(cursor)

      if (!segment) {
        console.warn(`Not a KCP segment`)
        break
      }

      await this.#onSegment(segment)
    }
  }

  async #onSegment(segment: KcpSegment<Opaque>) {
    if (segment.conversation !== this.stream.overt.conversation)
      return

    if (segment.command === KcpSegment.commands.push)
      return await this.#onPushSegment(segment)
    if (segment.command === KcpSegment.commands.ack)
      return await this.#onAckSegment(segment)
    if (segment.command === KcpSegment.commands.wask)
      return await this.#onWaskSegment(segment)
  }

  async #onPushSegment(segment: KcpSegment<Opaque>) {
    const conversation = this.stream.overt.conversation
    const command = KcpSegment.commands.ack
    const timestamp = segment.timestamp
    const serial = segment.serial
    const unackSerial = this.stream.recv_counter
    const fragment = new Empty()
    const ack = KcpSegment.new({ conversation, command, timestamp, serial, unackSerial, fragment })
    this.stream.writer.pair.enqueue(ack.prepare())

    if (segment.serial < this.stream.recv_counter) {
      console.warn(`Received previous KCP segment`)
      return
    }

    if (segment.serial > this.stream.recv_counter) {
      console.warn(`Received next KCP segment`)
      this.#buffer.set(segment.serial, segment)
      return
    }

    this.pair.enqueue(segment.fragment)
    this.stream.recv_counter++

    let next: KcpSegment<Opaque> | undefined

    while (next = this.#buffer.get(this.stream.recv_counter)) {
      console.warn(`Unblocked next KCP segment`)
      this.pair.enqueue(next.fragment)
      this.#buffer.delete(this.stream.recv_counter)
      this.stream.recv_counter++
    }
  }

  async #onAckSegment(segment: KcpSegment<Opaque>) {
    this.stream.overt.reader.dispatchEvent(new MessageEvent("ack", { data: segment }))
  }

  async #onWaskSegment(segment: KcpSegment<Opaque>) {
    const conversation = this.stream.overt.conversation
    const command = KcpSegment.commands.wins
    const serial = 0
    const unackSerial = this.stream.recv_counter
    const fragment = new Empty()
    const wins = KcpSegment.new({ conversation, command, serial, unackSerial, fragment })
    this.stream.writer.pair.enqueue(wins.prepare())
  }

}