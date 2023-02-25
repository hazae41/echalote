import { Cursor, Opaque, Writable } from "@hazae41/binary";
import { ErrorEvent } from "libs/events/error.js";
import { Events } from "libs/events/events.js";
import { AsyncEventTarget } from "libs/events/target.js";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { RelayDataCell } from "mods/tor/binary/cells/relayed/relay_data/cell.js";
import { RelayEndCell } from "mods/tor/binary/cells/relayed/relay_end/cell.js";
import { Circuit } from "mods/tor/circuit.js";
import { PAYLOAD_LEN } from "mods/tor/constants.js";

const DATA_LEN = PAYLOAD_LEN - (1 + 2 + 2 + 4 + 2)

export class TcpStream extends AsyncEventTarget {
  readonly #class = TcpStream

  readonly readable: ReadableStream<Opaque>
  readonly writable: WritableStream<Writable>

  #input?: ReadableStreamDefaultController<Opaque>
  #output?: WritableStreamDefaultController

  #closed = false

  constructor(
    readonly circuit: Circuit,
    readonly id: number,
    readonly signal?: AbortSignal
  ) {
    super()

    const onClose = this.#onCircuitClose.bind(this)
    this.circuit.addEventListener("close", onClose, { passive: true })

    const onError = this.#onCircuitError.bind(this)
    this.circuit.addEventListener("error", onError, { passive: true })

    const onRelayDataCell = this.#onRelayDataCell.bind(this)
    this.circuit.addEventListener("RELAY_DATA", onRelayDataCell, { passive: true })

    const onRelayEndCell = this.#onRelayEndCell.bind(this)
    this.circuit.addEventListener("RELAY_END", onRelayEndCell, { passive: true })

    this.readable = new ReadableStream({
      start: this.#onReadStart.bind(this)
    })

    this.writable = new WritableStream({
      start: this.#onWriteStart.bind(this),
      write: this.#onWrite.bind(this),
    })
  }

  get closed() {
    return this.#closed
  }

  async #onReadStart(controller: ReadableStreamDefaultController<Opaque>) {
    this.#input = controller
  }

  async #onWriteStart(controller: WritableStreamDefaultController) {
    this.#output = controller
  }

  async #onCircuitClose(event: Event) {
    const closeEvent = event as CloseEvent

    console.debug(`${this.#class.name}.onCircuitClose`, event)

    this.#closed = true

    const error = new Error(`Circuit closed`, { cause: closeEvent })

    try { this.#input!.close() } catch (e: unknown) { }
    try { this.#output!.error(error) } catch (e: unknown) { }

    const closeEventClone = Events.clone(closeEvent)
    if (!await this.dispatchEvent(closeEventClone)) return
  }

  async #onCircuitError(event: Event) {
    const errorEvent = event as ErrorEvent

    console.debug(`${this.#class.name}.onCircuitError`, event)

    this.#closed = true

    try { this.#input!.error(errorEvent.error) } catch (e: unknown) { }
    try { this.#output!.error(errorEvent.error) } catch (e: unknown) { }

    const errorEventClone = Events.clone(event)
    if (!await this.dispatchEvent(errorEventClone)) return
  }

  async #onRelayDataCell(event: Event) {
    const msgEvent = event as MessageEvent<RelayDataCell<Opaque>>
    if (msgEvent.data.stream !== this) return

    console.debug(`${this.#class.name}.onRelayDataCell`, event)

    try {
      this.#input!.enqueue(msgEvent.data.data)
    } catch (e: unknown) { }

    const msgEventClone = Events.clone(msgEvent)
    if (!await this.dispatchEvent(msgEventClone)) return
  }

  async #onRelayEndCell(event: Event) {
    const msgEvent = event as MessageEvent<RelayEndCell>
    if (msgEvent.data.stream !== this) return

    console.debug(`${this.#class.name}.onRelayEndCell`, event)

    this.#closed = true

    const error = new Error(`Relay closed`, { cause: msgEvent })

    try { this.#input!.close() } catch (e: unknown) { }
    try { this.#output!.error(error) } catch (e: unknown) { }

    const msgEventClone = Events.clone(msgEvent)
    if (!await this.dispatchEvent(msgEventClone)) return
  }

  async #onWrite(writable: Writable) {
    if (writable.size() <= DATA_LEN)
      return this.#onWriteDirect(writable)
    else
      return this.#onWriteChunked(writable)
  }

  async #onWriteDirect(writable: Writable) {
    const cell = new RelayDataCell(this.circuit, this, writable)
    return this.circuit.tor.writer.enqueue(RelayCell.from(cell).cell())
  }

  async #onWriteChunked(writable: Writable) {
    const bytes = Writable.toBytes(writable)
    const cursor = new Cursor(bytes)

    for (const chunk of cursor.split(DATA_LEN)) {
      this.#onWriteDirect(new Opaque(chunk))
    }
  }
}