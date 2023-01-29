import { Binary } from "@hazae41/binary";
import { AbortEvent } from "libs/events/abort.js";
import { Events } from "libs/events/events.js";
import { RelayDataCell } from "mods/tor/binary/cells/relayed/relay_data/cell.js";
import { RelayEndCell } from "mods/tor/binary/cells/relayed/relay_end/cell.js";
import { Circuit } from "mods/tor/circuit.js";
import { PAYLOAD_LEN } from "mods/tor/constants.js";

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

    const onClose = this.onClose.bind(this)
    this.circuit.addEventListener("error", onClose, { passive: true })

    const onError = this.onError.bind(this)
    this.circuit.addEventListener("error", onError, { passive: true })

    const onAbort = this.onAbort.bind(this)
    this.signal?.addEventListener("abort", onAbort, { passive: true })

    const onRelayDataCell = this.onRelayDataCell.bind(this)
    this.circuit.addEventListener("RELAY_DATA", onRelayDataCell, { passive: true })

    const onRelayEndCell = this.onRelayEndCell.bind(this)
    this.circuit.addEventListener("RELAY_END", onRelayEndCell, { passive: true })

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

  private async onClose(e: Event) {
    const event = Events.clone(e) as CloseEvent
    if (!this.dispatchEvent(event)) return

    try { this.input.close() } catch (e: unknown) { }
    try { this.output.error() } catch (e: unknown) { }
  }

  private async onError(e: Event) {
    const event = Events.clone(e) as ErrorEvent
    if (!this.dispatchEvent(event)) return

    try { this.input.error(event.error) } catch (e: unknown) { }
    try { this.output.error(event.error) } catch (e: unknown) { }
  }

  private async onAbort(e: Event) {
    const event = Events.clone(e) as AbortEvent
    if (!this.dispatchEvent(event)) return

    try { this.input.error(event.target.reason) } catch (e: unknown) { }
    try { this.output.error(event.target.reason) } catch (e: unknown) { }
  }

  private async onRelayDataCell(e: Event) {
    const event = Events.clone(e) as MessageEvent<RelayDataCell>
    if (event.data.stream !== this) return
    if (!this.dispatchEvent(event)) return

    this.input.enqueue(event.data.data)
  }

  private async onRelayEndCell(e: Event) {
    const event = Events.clone(e) as MessageEvent<RelayEndCell>
    if (event.data.stream !== this) return
    if (!this.dispatchEvent(event)) return

    try { this.input.close() } catch (e: unknown) { }
    try { this.output.error() } catch (e: unknown) { }
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