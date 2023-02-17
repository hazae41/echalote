import { Cursor, Writable } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { Future } from "libs/futures/future.js";
import { StreamPair } from "libs/streams/pair.js";
import { KcpSegment } from "./segment.js";
import { KcpStream, PrivateKcpStream } from "./stream.js";

export class KcpReader extends AsyncEventTarget {

  constructor() {
    super()
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

export class PrivateKcpReader {

  readonly pair: StreamPair<Uint8Array, Uint8Array>

  constructor(
    readonly publics: KcpStream,
    readonly privates: PrivateKcpStream
  ) {
    this.pair = new StreamPair({}, { write: this.#onRead.bind(this) })
  }

  async #onRead(chunk: Uint8Array) {
    const cursor = new Cursor(chunk)

    while (cursor.remaining) {
      const segment = KcpSegment.tryRead(cursor)

      if (!segment) {
        console.warn("kcp", chunk)
        break
      }

      await this.#onSegment(segment)
    }
  }

  async #onSegment(segment: KcpSegment) {
    if (segment.conversation !== this.publics.conversation)
      return

    console.log("<-", segment)

    if (segment.command === KcpSegment.commands.push)
      return await this.#onPush(segment)
    if (segment.command === KcpSegment.commands.ack)
      return await this.#onAck(segment)
    if (segment.command === KcpSegment.commands.wask)
      return await this.#onWask(segment)
  }

  async #onPush(segment: KcpSegment) {
    if (segment.serial !== this.privates.recv_counter) {
      console.warn("got old segment", segment.serial, segment)
      return
    }

    this.privates.recv_counter++
    this.pair.enqueue(segment.data)

    const conversation = this.publics.conversation
    const command = KcpSegment.commands.ack
    const timestamp = segment.timestamp
    const serial = segment.serial
    const una = this.privates.recv_counter
    const ack = new KcpSegment(conversation, command, 0, 65535, timestamp, serial, una, new Uint8Array())
    this.privates.writer.pair.enqueue(Writable.toBytes(ack))
  }

  async #onAck(segment: KcpSegment) {
    this.publics.reader.dispatchEvent(new MessageEvent("ack", { data: segment }))
  }

  async #onWask(_: KcpSegment) {
    const conversation = this.publics.conversation
    const command = KcpSegment.commands.wins
    const send_counter = 0
    const recv_counter = this.privates.recv_counter
    const wins = new KcpSegment(conversation, command, 0, 65535, Date.now() / 1000, send_counter, recv_counter, new Uint8Array())
    this.privates.writer.pair.enqueue(Writable.toBytes(wins))
  }

}