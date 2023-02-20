import { Opaque, Writable } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { StreamPair } from "libs/streams/pair.js";
import { KcpSegment } from "./segment.js";
import { SecretKcpStream } from "./stream.js";

export class KcpWriter extends AsyncEventTarget {

  readonly #secret: SecretKcpWriter

  constructor(
    readonly stream: SecretKcpStream
  ) {
    super()

    this.#secret = new SecretKcpWriter(this, this.stream)
  }

  static secret(stream: SecretKcpStream) {
    return new this(stream).#secret
  }

}

export class SecretKcpWriter {

  readonly pair: StreamPair<Uint8Array, Uint8Array>

  constructor(
    readonly overt: KcpWriter,
    readonly stream: SecretKcpStream,
  ) {
    this.pair = new StreamPair({}, { write: this.#onWrite.bind(this) })
  }

  async #onWrite(chunk: Uint8Array) {
    const conversation = this.stream.overt.conversation
    const command = KcpSegment.commands.push
    const send_counter = this.stream.send_counter++
    const recv_counter = this.stream.recv_counter
    const segment = new KcpSegment(conversation, command, 0, 65535, Date.now() / 1000, send_counter, recv_counter, new Opaque(chunk))
    console.log("->", segment)
    this.pair.enqueue(Writable.toBytes(segment))
  }

}