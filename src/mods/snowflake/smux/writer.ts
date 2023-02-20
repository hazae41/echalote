import { Empty, Opaque, Writable } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { StreamPair } from "libs/streams/pair.js";
import { SmuxSegment, SmuxUpdate } from "mods/snowflake/smux/segment.js";
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
    await this.#sendSYN(controller)
    await this.#sendUPD(controller)
  }

  async #sendSYN(controller: ReadableStreamDefaultController<Uint8Array>) {
    const segment = new SmuxSegment(2, SmuxSegment.commands.syn, 1, new Empty())
    controller.enqueue(Writable.toBytes(segment))
  }

  async #sendUPD(controller: ReadableStreamDefaultController<Uint8Array>) {
    const update = new SmuxUpdate(0, 1048576)
    const segment = new SmuxSegment(2, SmuxSegment.commands.upd, 1, update)
    controller.enqueue(Writable.toBytes(segment))
  }

  async #onWrite(chunk: Uint8Array) {
    const segment = new SmuxSegment(2, SmuxSegment.commands.psh, 1, new Opaque(chunk))
    this.pair.enqueue(Writable.toBytes(segment))
  }

}