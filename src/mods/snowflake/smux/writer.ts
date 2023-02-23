import { Empty, Writable } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { StreamPair } from "libs/streams/pair.js";
import { SmuxSegment, SmuxUpdate } from "mods/snowflake/smux/segment.js";
import { SecretSmuxStream } from "./stream.js";

export class SecretSmuxWriter extends AsyncEventTarget<"close" | "error">{

  readonly pair: StreamPair<Writable, Writable>

  constructor(
    readonly stream: SecretSmuxStream
  ) {
    super()

    this.pair = new StreamPair({
      start: this.#onStart.bind(this),
    }, {
      write: this.#onWrite.bind(this)
    })
  }

  async #onStart(controller: ReadableStreamDefaultController<Writable>) {
    await this.#sendSYN(controller)
    await this.#sendUPD(controller)
  }

  async #sendSYN(controller: ReadableStreamDefaultController<Writable>) {
    const segment = new SmuxSegment(2, SmuxSegment.commands.syn, 1, new Empty())
    controller.enqueue(segment.prepare())
  }

  async #sendUPD(controller: ReadableStreamDefaultController<Writable>) {
    const update = new SmuxUpdate(0, 1048576)
    const segment = new SmuxSegment(2, SmuxSegment.commands.upd, 1, update)
    controller.enqueue(segment.prepare())
  }

  async #onWrite(chunk: Writable) {
    const inflight = this.stream.selfWrite - this.stream.peerConsumed

    if (inflight >= this.stream.peerWindow)
      throw new Error(`Peer window reached`)

    const segment = new SmuxSegment(2, SmuxSegment.commands.psh, 1, chunk)
    this.pair.enqueue(segment.prepare())

    this.stream.selfWrite += chunk.size()
  }

}