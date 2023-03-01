import { Empty, Writable } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { SuperTransformStream } from "libs/streams/transform.js";
import { SmuxSegment, SmuxUpdate } from "mods/snowflake/smux/segment.js";
import { SecretSmuxStream } from "./stream.js";

export class SecretSmuxWriter extends AsyncEventTarget<{
  close: CloseEvent,
  error: ErrorEvent
}>{

  readonly stream: SuperTransformStream<Writable, Writable>

  constructor(
    readonly parent: SecretSmuxStream
  ) {
    super()

    this.stream = new SuperTransformStream({
      start: this.#onStart.bind(this),
      transform: this.#onWrite.bind(this)
    })
  }

  async #onStart() {
    await this.#sendSYN()
    await this.#sendUPD()
  }

  async #sendSYN() {
    const segment = new SmuxSegment(2, SmuxSegment.commands.syn, this.parent.streamID, new Empty())
    this.stream.enqueue(segment.prepare())
  }

  async #sendUPD() {
    const update = new SmuxUpdate(0, this.parent.selfWindow)
    const segment = new SmuxSegment(2, SmuxSegment.commands.upd, this.parent.streamID, update)
    this.stream.enqueue(segment.prepare())
  }

  async #onWrite(chunk: Writable) {
    const inflight = this.parent.selfWrite - this.parent.peerConsumed

    if (inflight >= this.parent.peerWindow)
      throw new Error(`Peer window reached`)

    const segment = new SmuxSegment(2, SmuxSegment.commands.psh, this.parent.streamID, chunk)
    this.stream.enqueue(segment.prepare())

    this.parent.selfWrite += chunk.size()
  }

}