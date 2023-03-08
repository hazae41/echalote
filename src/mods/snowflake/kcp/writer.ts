import { Opaque, Writable } from "@hazae41/binary";
import { Future } from "@hazae41/future";
import { CloseAndErrorEvents, Events } from "libs/events/events.js";
import { AsyncEventTarget } from "libs/events/target.js";
import { SuperTransformStream } from "libs/streams/transform.js";
import { KcpSegment } from "./segment.js";
import { SecretKcpDuplex } from "./stream.js";

export class SecretKcpWriter {

  readonly events = new AsyncEventTarget<CloseAndErrorEvents>()

  readonly stream: SuperTransformStream<Writable, Writable>

  closed = false

  constructor(
    readonly parent: SecretKcpDuplex,
  ) {
    this.stream = new SuperTransformStream({
      transform: this.#onWrite.bind(this)
    })
  }

  async #onWrite(fragment: Writable) {
    if (this.stream.closed) return

    const conversation = this.parent.conversation
    const command = KcpSegment.commands.push
    const serial = this.parent.send_counter++
    const unackSerial = this.parent.recv_counter
    const segment = KcpSegment.new({ conversation, command, serial, unackSerial, fragment })
    const writable = segment.prepare()
    this.stream.enqueue(writable)

    const start = Date.now()

    const retry = setInterval(() => {
      if (this.stream.closed) {
        clearInterval(retry)
        return
      }

      const delay = Date.now() - start
      console.debug(`Retrying KCP after`, delay, `milliseconds`)
      this.stream.enqueue(writable)
    }, 1000)

    const future = new Future<void>()

    const onEvent = (event: MessageEvent<KcpSegment<Opaque>>) => {
      if (event.data.serial !== serial) return
      future.resolve()
    }

    Events.waitFor(this.parent.reader.events, "ack", { future, onEvent })
      .catch(() => { })
      .finally(() => clearInterval(retry))
  }

}