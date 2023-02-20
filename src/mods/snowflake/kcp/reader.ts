import { Cursor, Empty, Opaque, Writable } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { Future } from "libs/futures/future.js";
import { StreamPair } from "libs/streams/pair.js";
import { KcpSegment } from "./segment.js";
import { SecretKcpStream } from "./stream.js";

export class KcpReader extends AsyncEventTarget {

  readonly #secret: SecretKcpReader

  constructor(
    readonly stream: SecretKcpStream
  ) {
    super()

    this.#secret = new SecretKcpReader(this, this.stream)
  }

  static secret(stream: SecretKcpStream) {
    return new this(stream).#secret
  }

  async wait<T extends Event>(event: string) {
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

  readonly pair: StreamPair<Uint8Array, Uint8Array>

  constructor(
    readonly overt: KcpReader,
    readonly stream: SecretKcpStream
  ) {
    this.pair = new StreamPair({}, { write: this.#onRead.bind(this) })
  }

  async #onRead(chunk: Uint8Array) {
    const cursor = new Cursor(chunk)

    while (cursor.remaining) {
      const segment = KcpSegment.tryRead(cursor)

      if (!segment) break

      await this.#onSegment(segment)
    }
  }

  async #onSegment(segment: KcpSegment<Opaque>) {
    if (segment.conversation !== this.stream.overt.conversation)
      return

    console.log("<-", segment)

    if (segment.command === KcpSegment.commands.push)
      return await this.#onPush(segment)
    if (segment.command === KcpSegment.commands.ack)
      return await this.#onAck(segment)
    if (segment.command === KcpSegment.commands.wask)
      return await this.#onWask(segment)
  }

  async #onPush(segment: KcpSegment<Opaque>) {
    if (segment.serial !== this.stream.recv_counter)
      return

    this.stream.recv_counter++
    this.pair.enqueue(segment.fragment.bytes)

    const conversation = this.stream.overt.conversation
    const command = KcpSegment.commands.ack
    const timestamp = segment.timestamp
    const serial = segment.serial
    const una = this.stream.recv_counter
    const ack = new KcpSegment(conversation, command, 0, 65535, timestamp, serial, una, new Empty())
    this.stream.writer.pair.enqueue(Writable.toBytes(ack))
  }

  async #onAck(segment: KcpSegment<Opaque>) {
    this.stream.overt.reader.dispatchEvent(new MessageEvent("ack", { data: segment }))
  }

  async #onWask(segment: KcpSegment<Opaque>) {
    const conversation = this.stream.overt.conversation
    const command = KcpSegment.commands.wins
    const send_counter = 0
    const recv_counter = this.stream.recv_counter
    const wins = new KcpSegment(conversation, command, 0, 65535, Date.now() / 1000, send_counter, recv_counter, new Empty())
    this.stream.writer.pair.enqueue(Writable.toBytes(wins))
  }

}