import { Writable } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { StreamPair } from "libs/streams/pair.js";
import { KcpSegment } from "./segment.js";
import { KcpStream, PrivateKcpStream } from "./stream.js";

export class KcpWriter extends AsyncEventTarget {

  constructor() {
    super()
  }

}

export class PrivateKcpWriter {

  readonly pair: StreamPair<Uint8Array, Uint8Array>

  constructor(
    readonly publics: KcpStream,
    readonly privates: PrivateKcpStream,
  ) {
    this.pair = new StreamPair({}, { write: this.#onWrite.bind(this) })
  }

  async #onWrite(chunk: Uint8Array) {
    const conversation = this.publics.conversation
    const command = KcpSegment.commands.push
    const send_counter = this.privates.send_counter++
    const recv_counter = this.privates.recv_counter
    const segment = new KcpSegment(conversation, command, 0, 65535, Date.now() / 1000, send_counter, recv_counter, chunk)
    console.log("->", segment)
    this.pair.enqueue(Writable.toBytes(segment))
  }

}