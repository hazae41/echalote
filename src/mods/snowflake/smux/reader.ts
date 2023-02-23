import { Cursor, Empty, Opaque } from "@hazae41/binary";
import { AsyncEventTarget } from "libs/events/target.js";
import { StreamPair } from "libs/streams/pair.js";
import { SmuxSegment, SmuxUpdate } from "mods/snowflake/smux/segment.js";
import { SecretSmuxStream } from "./stream.js";

export class SecretSmuxReader extends AsyncEventTarget<"close" | "error"> {

  readonly pair: StreamPair<Opaque, Opaque>

  constructor(
    readonly stream: SecretSmuxStream
  ) {
    super()

    this.pair = new StreamPair({}, {
      write: this.#onRead.bind(this)
    })
  }

  async #onRead(chunk: Opaque) {
    // console.debug("<-", chunk)

    if (this.stream.buffer.offset)
      await this.#onReadBuffered(chunk.bytes)
    else
      await this.#onReadDirect(chunk.bytes)
  }

  async #onReadBuffered(chunk: Uint8Array) {
    this.stream.buffer.write(chunk)
    const full = new Uint8Array(this.stream.buffer.before)

    this.stream.buffer.offset = 0
    await this.#onReadDirect(full)
  }

  async #onReadDirect(chunk: Uint8Array) {
    const cursor = new Cursor(chunk)

    while (cursor.remaining) {
      const segment = SmuxSegment.tryRead(cursor)

      if (!segment) {
        this.stream.buffer.write(cursor.after)
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
    if (segment.stream !== this.stream.streamID)
      throw new Error(`Invalid SMUX stream ID ${segment.stream}`)

    this.stream.selfRead += segment.fragment.bytes.length
    this.stream.selfIncrement += segment.fragment.bytes.length

    this.pair.enqueue(segment.fragment)

    if (this.stream.selfIncrement >= (this.stream.selfWindow / 2)) {
      const update = new SmuxUpdate(this.stream.selfRead, this.stream.selfWindow)
      const segment = new SmuxSegment(2, SmuxSegment.commands.upd, this.stream.streamID, update)
      this.stream.writer.pair.enqueue(segment.prepare())
      this.stream.selfIncrement = 0
    }
  }

  async #onNopSegment(ping: SmuxSegment<Opaque>) {
    const pong = new SmuxSegment(2, SmuxSegment.commands.nop, ping.stream, new Empty())
    this.stream.writer.pair.enqueue(pong.prepare())
  }

  async #onUpdSegment(segment: SmuxSegment<Opaque>) {
    if (segment.stream !== this.stream.streamID)
      throw new Error(`Invalid SMUX stream ID ${segment.stream}`)

    const update = segment.fragment.into(SmuxUpdate)
    this.stream.peerConsumed = update.consumed
    this.stream.peerWindow = update.window
  }

  async #onFinSegment(segment: SmuxSegment<Opaque>) {
    if (segment.stream !== this.stream.streamID)
      throw new Error(`Invalid SMUX stream ID ${segment.stream}`)

    this.pair.terminate()
  }

}