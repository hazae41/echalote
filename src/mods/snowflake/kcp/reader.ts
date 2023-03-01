import { Cursor, Empty, Opaque } from "@hazae41/binary";
import { AbortEvent } from "libs/events/abort.js";
import { AsyncEventTarget } from "libs/events/target.js";
import { Future } from "libs/futures/future.js";
import { SuperTransformStream } from "libs/streams/transform.js";
import { KcpSegment } from "./segment.js";
import { SecretKcpStream } from "./stream.js";

export type SecretKcpReaderEvents = {
  "close": CloseEvent,
  "error": ErrorEvent,
  "ack": MessageEvent<KcpSegment<Opaque>>
}

export class SecretKcpReader extends AsyncEventTarget<SecretKcpReaderEvents>  {

  readonly stream: SuperTransformStream<Opaque, Opaque>

  readonly #buffer = new Map<number, KcpSegment<Opaque>>()

  constructor(
    readonly parent: SecretKcpStream
  ) {
    super()

    this.stream = new SuperTransformStream({
      transform: this.#onRead.bind(this)
    })
  }

  async wait<K extends keyof SecretKcpReaderEvents>(type: K, signal?: AbortSignal) {
    const future = new Future<SecretKcpReaderEvents[K], Error>()
    const onEvent = (event: SecretKcpReaderEvents[K]) => future.ok(event)
    return await this.waitFor(type, { future, onEvent, signal })
  }

  async waitFor<T, K extends keyof SecretKcpReaderEvents>(type: K, params: {
    future: Future<T, Error>,
    onEvent: (event: SecretKcpReaderEvents[K]) => void,
    signal?: AbortSignal
  }) {
    const { future, onEvent, signal } = params

    const onAbort = (event: Event) => {
      const abortEvent = event as AbortEvent
      const error = new Error(`Aborted`, { cause: abortEvent.target.reason })
      future.err(error)
    }

    const onClose = (event: CloseEvent) => {
      const error = new Error(`Closed`, { cause: event })
      future.err(error)
    }

    const onError = (event: ErrorEvent) => {
      const error = new Error(`Errored`, { cause: event })
      future.err(error)
    }

    try {
      signal?.addEventListener("abort", onAbort, { passive: true })
      this.addEventListener("close", onClose, { passive: true })
      this.addEventListener("error", onError, { passive: true })
      this.addEventListener(type, onEvent, { passive: true })

      return await future.promise
    } finally {
      signal?.removeEventListener("abort", onAbort)
      this.removeEventListener("close", onClose)
      this.removeEventListener("error", onError)
      this.removeEventListener(type, onEvent)
    }
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
    await this.dispatchEvent(msgEvent, "ack")
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