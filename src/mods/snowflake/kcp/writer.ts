import { Opaque, Writable } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { Future } from "libs/futures/future.js";
import { StreamPair } from "libs/streams/pair.js";
import { KcpSegment } from "./segment.js";
import { SecretKcpStream } from "./stream.js";

export class SecretKcpWriter extends AsyncEventTarget<"close" | "error"> {

  readonly pair: StreamPair<Writable, Writable>

  constructor(
    readonly stream: SecretKcpStream,
  ) {
    super()

    this.pair = new StreamPair({}, {
      write: this.#onWrite.bind(this)
    })
  }

  async #onWrite(fragment: Writable) {
    const conversation = this.stream.conversation
    const command = KcpSegment.commands.push
    const serial = this.stream.send_counter++
    const unackSerial = this.stream.recv_counter
    const segment = KcpSegment.new({ conversation, command, serial, unackSerial, fragment })
    const writable = segment.prepare()
    this.pair.enqueue(writable)

    const start = Date.now()

    const retry = setInterval(() => {
      const delay = Date.now() - start
      console.warn(`Retrying KCP after`, delay, `milliseconds`)
      this.pair.enqueue(writable)
    }, 1000)

    const future = new Future<void, Error>()

    const onEvent = (event: Event) => {
      const msgEvent = event as MessageEvent<KcpSegment<Opaque>>
      if (msgEvent.data.serial !== serial) return
      future.ok()
    }

    this.stream.reader
      .waitFor("ack", { future, onEvent })
      .catch(() => { })
      .finally(() => clearInterval(retry))
  }

}