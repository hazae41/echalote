import { Cursor, Empty, Opaque } from "@hazae41/binary";
import { CloseAndErrorEvents } from "libs/events/events.js";
import { AsyncEventTarget } from "libs/events/target.js";
import { SuperTransformStream } from "libs/streams/transform.js";
import { KcpSegment } from "./segment.js";
import { SecretKcpStream } from "./stream.js";

export type SecretKcpReaderEvents = CloseAndErrorEvents & {
  ack: MessageEvent<KcpSegment<Opaque>>
}

export class SecretKcpReader {

  readonly events = new AsyncEventTarget<SecretKcpReaderEvents>()

  readonly stream: SuperTransformStream<Opaque, Opaque>

  readonly #buffer = new Map<number, KcpSegment<Opaque>>()

  constructor(
    readonly parent: SecretKcpStream
  ) {
    this.stream = new SuperTransformStream({
      transform: this.#onRead.bind(this)
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
    if (segment.conversation !== this.parent.conversation)
      return

    if (segment.command === KcpSegment.commands.push)
      return await this.#onPushSegment(segment)
    if (segment.command === KcpSegment.commands.ack)
      return await this.#onAckSegment(segment)
    if (segment.command === KcpSegment.commands.wask)
      return await this.#onWaskSegment(segment)
  }

  async #onPushSegment(segment: KcpSegment<Opaque>) {
    const conversation = this.parent.conversation
    const command = KcpSegment.commands.ack
    const timestamp = segment.timestamp
    const serial = segment.serial
    const unackSerial = this.parent.recv_counter
    const fragment = new Empty()
    const ack = KcpSegment.new({ conversation, command, timestamp, serial, unackSerial, fragment })
    this.parent.writer.stream.enqueue(ack.prepare())

    if (segment.serial < this.parent.recv_counter) {
      console.warn(`Received previous KCP segment`)
      return
    }

    if (segment.serial > this.parent.recv_counter) {
      console.warn(`Received next KCP segment`)
      this.#buffer.set(segment.serial, segment)
      return
    }

    this.stream.enqueue(segment.fragment)
    this.parent.recv_counter++

    let next: KcpSegment<Opaque> | undefined

    while (next = this.#buffer.get(this.parent.recv_counter)) {
      console.warn(`Unblocked next KCP segment`)
      this.stream.enqueue(next.fragment)
      this.#buffer.delete(this.parent.recv_counter)
      this.parent.recv_counter++
    }
  }

  async #onAckSegment(segment: KcpSegment<Opaque>) {
    const msgEvent = new MessageEvent("ack", { data: segment })
    await this.events.dispatchEvent(msgEvent, "ack")
  }

  async #onWaskSegment(segment: KcpSegment<Opaque>) {
    const conversation = this.parent.conversation
    const command = KcpSegment.commands.wins
    const serial = 0
    const unackSerial = this.parent.recv_counter
    const fragment = new Empty()
    const wins = KcpSegment.new({ conversation, command, serial, unackSerial, fragment })
    this.parent.writer.stream.enqueue(wins.prepare())
  }

}