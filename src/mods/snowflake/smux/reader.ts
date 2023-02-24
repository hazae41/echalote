import { Cursor, Empty, Opaque } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { SuperTransformStream } from "libs/streams/transform.js";
import { SmuxSegment, SmuxUpdate } from "mods/snowflake/smux/segment.js";
import { SecretSmuxStream } from "./stream.js";

export class SecretSmuxReader extends AsyncEventTarget<"close" | "error"> {

  readonly stream: SuperTransformStream<Opaque, Opaque>

  constructor(
    readonly parent: SecretSmuxStream
  ) {
    super()

    this.stream = new SuperTransformStream({
      transform: this.#onRead.bind(this)
    })
  }

  async #onRead(chunk: Opaque) {
    // console.debug("<-", chunk)

    if (this.parent.buffer.offset)
      await this.#onReadBuffered(chunk.bytes)
    else
      await this.#onReadDirect(chunk.bytes)
  }

  async #onReadBuffered(chunk: Uint8Array) {
    this.parent.buffer.write(chunk)
    const full = new Uint8Array(this.parent.buffer.before)

    this.parent.buffer.offset = 0
    await this.#onReadDirect(full)
  }

  async #onReadDirect(chunk: Uint8Array) {
    const cursor = new Cursor(chunk)

    while (cursor.remaining) {
      const segment = SmuxSegment.tryRead(cursor)

      if (!segment) {
        this.parent.buffer.write(cursor.after)
        break
      }

      await this.#onSegment(segment)
    }
  }

  async #onSegment(segment: SmuxSegment<Opaque>) {
    if (segment.version !== 2)
      throw new Error(`Invalid SMUX version`)

    // console.log("<-", segment)

    if (segment.command === SmuxSegment.commands.psh)
      return await this.#onPshSegment(segment)
    if (segment.command === SmuxSegment.commands.nop)
      return await this.#onNopSegment(segment)
    if (segment.command === SmuxSegment.commands.upd)
      return await this.#onUpdSegment(segment)
    if (segment.command === SmuxSegment.commands.fin)
      return await this.#onFinSegment(segment)
    console.warn(segment)
  }

  async #onPshSegment(segment: SmuxSegment<Opaque>) {
    if (segment.stream !== this.parent.streamID)
      throw new Error(`Invalid SMUX stream ID ${segment.stream}`)

    this.parent.selfRead += segment.fragment.bytes.length
    this.parent.selfIncrement += segment.fragment.bytes.length

    this.stream.enqueue(segment.fragment)

    if (this.parent.selfIncrement >= (this.parent.selfWindow / 2)) {
      const update = new SmuxUpdate(this.parent.selfRead, this.parent.selfWindow)
      const segment = new SmuxSegment(2, SmuxSegment.commands.upd, this.parent.streamID, update)
      this.parent.writer.stream.enqueue(segment.prepare())
      this.parent.selfIncrement = 0
    }
  }

  async #onNopSegment(ping: SmuxSegment<Opaque>) {
    const pong = new SmuxSegment(2, SmuxSegment.commands.nop, ping.stream, new Empty())
    this.parent.writer.stream.enqueue(pong.prepare())
  }

  async #onUpdSegment(segment: SmuxSegment<Opaque>) {
    if (segment.stream !== this.parent.streamID)
      throw new Error(`Invalid SMUX stream ID ${segment.stream}`)

    const update = segment.fragment.into(SmuxUpdate)
    this.parent.peerConsumed = update.consumed
    this.parent.peerWindow = update.window
  }

  async #onFinSegment(segment: SmuxSegment<Opaque>) {
    if (segment.stream !== this.parent.streamID)
      throw new Error(`Invalid SMUX stream ID ${segment.stream}`)

    this.stream.terminate()
  }

}