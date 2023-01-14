import { Binary } from "@hazae41/binary";
import { Events } from "libs/events.js";
import { RelayDataCell } from "mods/tor/binary/cells/relayed/relay_data/cell.js";
import { RelayEndCell } from "mods/tor/binary/cells/relayed/relay_end/cell.js";
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
  readonly readable: ReadableStream<Uint8Array>
  readonly writable: WritableStream<Uint8Array>

  private _input?: ReadableStreamController<Uint8Array>
  private _output?: WritableStreamDefaultController

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

    this.readable = new ReadableStream({
      start: this.onReadStart.bind(this)
    })

    this.writable = new WritableStream({
      start: this.onWriteStart.bind(this),
      write: this.onWrite.bind(this)
    })
  }

  get input() {
    return this._input!
  }

  get output() {
    return this._output!
  }

  private async onReadStart(controller: ReadableStreamController<Uint8Array>) {
    this._input = controller
  }

  private async onWriteStart(controller: WritableStreamDefaultController) {
    this._output = controller
  }

  private async onAbort(event: Event) {
    const abort = event as AbortEvent

    this.input.error(abort.target.reason)
    this.output.error(abort.target.reason)
  }

  private async onRelayDataCell(event: Event) {
    const message = event as MessageEvent<RelayDataCell>
    if (message.data.stream !== this) return

    const message2 = Events.clone(message)
    if (!this.dispatchEvent(message2)) return

    this.input.enqueue(message.data.data)
  }

  private async onRelayEndCell(event: Event) {
    const message = event as MessageEvent<RelayEndCell>
    if (message.data.stream !== this) return

    const message2 = Events.clone(message)
    if (!this.dispatchEvent(message2)) return

    this.input.close()
    this.output.error()
  }

  private async onRelayTruncatedCell(event: Event) {
    const message = event as MessageEvent<RelayTruncatedCell>

    const message2 = Events.clone(message)
    if (!this.dispatchEvent(message2)) return

    this.input.error(message)
    this.output.error(message)
  }

  private async onWrite(chunk: Uint8Array) {
    if (chunk.length <= DATA_LEN) {
      const cell = new RelayDataCell(this.circuit, this, chunk)
      return this.circuit.tor.output.enqueue(await cell.pack())
    }

    const binary = new Binary(chunk)
    const chunks = binary.split(DATA_LEN)

    for (const chunk of chunks) {
      const cell = new RelayDataCell(this.circuit, this, chunk)
      this.circuit.tor.output.enqueue(await cell.pack())
    }
  }
}