import { Opaque, Writable } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { Future } from "libs/futures/future.js";
import { SuperTransformStream } from "libs/streams/transform.js";
import { KcpSegment } from "./segment.js";
import { SecretKcpStream } from "./stream.js";

export class SecretKcpWriter extends AsyncEventTarget<"close" | "error"> {

  readonly stream: SuperTransformStream<Writable, Writable>

  closed = false

  constructor(
    readonly parent: SecretKcpStream,
  ) {
    super()

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

    const future = new Future<void, Error>()

    const onEvent = (event: Event) => {
      const msgEvent = event as MessageEvent<KcpSegment<Opaque>>
      if (msgEvent.data.serial !== serial) return
      future.ok()
    }

    this.parent.reader
      .waitFor("ack", { future, onEvent })
      .catch(() => { })
      .finally(() => clearInterval(retry))
  }

}