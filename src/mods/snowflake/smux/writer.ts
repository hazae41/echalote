import { Empty, Opaque, Writable } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { StreamPair } from "libs/streams/pair.js";
import { SmuxSegment } from "mods/snowflake/smux/segment.js";
import { SmuxStream } from "./stream.js";

export class SmuxWriter extends AsyncEventTarget {

  readonly pair: StreamPair<Uint8Array, Uint8Array>

  constructor(
    readonly stream: SmuxStream
  ) {
    super()

    this.pair = new StreamPair({
      start: this.#onStart.bind(this),
    }, {
      write: this.#onWrite.bind(this)
    })
  }

  async #onStart(controller: ReadableStreamDefaultController<Uint8Array>) {
    const segment = new SmuxSegment(2, SmuxSegment.commands.syn, 1, new Empty())
    controller.enqueue(Writable.toBytes(segment))
  }

  async #onWrite(chunk: Uint8Array) {
    const segment = new SmuxSegment(2, SmuxSegment.commands.psh, 1, new Opaque(chunk))
    this.pair.enqueue(Writable.toBytes(segment))
  }

}