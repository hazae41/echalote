import { Binary } from "@hazae41/binary";
import { Events } from "libs/events.js";
import { RelayDataCell } from "mods/tor/binary/cells/relayed/relay_data/cell.js";
import { RelayEndCell } from "mods/tor/binary/cells/relayed/relay_end/cell.js";
import { RelayEndReasonOther } from "mods/tor/binary/cells/relayed/relay_end/reason.js";
import { RelayTruncatedCell } from "mods/tor/binary/cells/relayed/relay_truncated/cell.js";
import { Circuit } from "mods/tor/circuit.js";
import { PAYLOAD_LEN } from "mods/tor/constants.js";

export interface AbortEvent extends Event {
  type: "abort"
  target: AbortSignal
  currentTarget: AbortSignal
}

const DATA_LEN = PAYLOAD_LEN - (1 + 2 + 2 + 4 + 2)

export class TcpStream extends EventTarget {
  /**
   * Output stream bufferer
   */
  readonly rstreams = new TransformStream<Buffer, Buffer>()

  /**
   * Input stream bufferer
   */
  readonly wstreams = new TransformStream<Buffer, Buffer>()

  /**
   * Output stream
   */
  readonly readable = this.rstreams.readable

  /**
   * Input stream
   */
  readonly writable = this.wstreams.writable

  private closed = false

  constructor(
    readonly circuit: Circuit,
    readonly id: number,
    readonly signal?: AbortSignal
  ) {
    super()

    const onRelayDataCell = this.onRelayDataCell.bind(this)
    this.circuit.addEventListener("RELAY_DATA", onRelayDataCell, { passive: true })

    const onRelayEndCell = this.onRelayEndCell.bind(this)
    this.circuit.addEventListener("RELAY_END", onRelayEndCell, { passive: true })

    const onRelayTruncatedCell = this.onRelayTruncatedCell.bind(this)
    this.circuit.addEventListener("RELAY_TRUNCATED", onRelayTruncatedCell, { passive: true })

    const onAbort = this.onAbort.bind(this)
    this.signal?.addEventListener("abort", onAbort, { passive: true, once: true })

    this.tryWrite().catch(console.warn)
  }

  private async onAbort(event: Event) {
    const abort = event as AbortEvent

    const event2 = Events.clone(event)
    if (!this.dispatchEvent(event2)) return

    if (this.closed) return

    this.closed = true

    const rwriter = this.rstreams.writable.getWriter()
    rwriter.abort(abort.target.reason).catch(console.warn)
    rwriter.releaseLock()

    const wwriter = this.wstreams.writable.getWriter()
    wwriter.abort(abort.target.reason).catch(console.warn)
    wwriter.releaseLock()

    const reason = RelayEndCell.reasons.REASON_UNKNOWN
    const reason2 = new RelayEndReasonOther(reason)
    const cell = new RelayEndCell(this.circuit, this, reason2)
    this.circuit.tor.send(await cell.pack())
  }

  private async onRelayDataCell(event: Event) {
    const message = event as MessageEvent<RelayDataCell>
    if (message.data.stream !== this) return

    const message2 = Events.clone(message)
    if (!this.dispatchEvent(message2)) return

    if (this.closed) return

    const rwriter = this.rstreams.writable.getWriter()
    rwriter.write(message.data.data).catch(console.warn)
    rwriter.releaseLock()
  }

  private async onRelayEndCell(event: Event) {
    const message = event as MessageEvent<RelayEndCell>
    if (message.data.stream !== this) return

    const message2 = Events.clone(message)
    if (!this.dispatchEvent(message2)) return

    if (this.closed) return

    this.closed = true

    const rwriter = this.rstreams.writable.getWriter()
    rwriter.close().catch(console.warn)
    rwriter.releaseLock()

    const wwriter = this.wstreams.writable.getWriter()
    wwriter.close().catch(console.warn)
    wwriter.releaseLock()
  }

  private async onRelayTruncatedCell(event: Event) {
    const message = event as MessageEvent<RelayTruncatedCell>

    const message2 = Events.clone(message)
    if (!this.dispatchEvent(message2)) return

    if (this.closed) return

    this.closed = true

    const rwriter = this.rstreams.writable.getWriter()
    rwriter.abort(event).catch(console.warn)
    rwriter.releaseLock()

    const wwriter = this.wstreams.writable.getWriter()
    wwriter.abort(event).catch(console.warn)
    wwriter.releaseLock()
  }

  private async tryWrite() {
    const reader = this.wstreams.readable.getReader()

    try {
      await this.write(reader)
    } catch (e: unknown) {
      console.warn(e)
    } finally {
      reader.releaseLock()
    }
  }

  private async write(reader: ReadableStreamDefaultReader<Buffer>) {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      await this.onWrite(value)
    }
  }

  private async onWrite(chunk: Buffer) {
    if (chunk.length <= DATA_LEN) {
      const cell = new RelayDataCell(this.circuit, this, chunk)
      return this.circuit.tor.send(await cell.pack())
    }

    const binary = new Binary(chunk)
    const chunks = binary.split(DATA_LEN)

    for (const chunk of chunks) {
      const cell = new RelayDataCell(this.circuit, this, chunk)
      this.circuit.tor.send(await cell.pack())
    }
  }
}