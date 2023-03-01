import { Cursor, Opaque, Writable } from "@hazae41/binary";
import { CloseEvent } from "libs/events/close.js";
import { ErrorEvent } from "libs/events/error.js";
import { SuperReadableStream } from "libs/streams/readable.js";
import { SuperWritableStream } from "libs/streams/writable.js";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { RelayDataCell } from "mods/tor/binary/cells/relayed/relay_data/cell.js";
import { RelayEndCell } from "mods/tor/binary/cells/relayed/relay_end/cell.js";
import { Circuit } from "mods/tor/circuit.js";
import { PAYLOAD_LEN } from "mods/tor/constants.js";

const DATA_LEN = PAYLOAD_LEN - (1 + 2 + 2 + 4 + 2)

export class TcpStream {
  readonly #class = TcpStream

  readonly #reader: SuperReadableStream<Opaque>
  readonly #writer: SuperWritableStream<Writable>

  readonly readable: ReadableStream<Opaque>
  readonly writable: WritableStream<Writable>

  constructor(
    readonly id: number,
    readonly circuit: Circuit,
    readonly signal?: AbortSignal
  ) {
    const onClose = this.#onCircuitClose.bind(this)
    this.circuit.events.addEventListener("close", onClose, { passive: true })

    const onError = this.#onCircuitError.bind(this)
    this.circuit.events.addEventListener("error", onError, { passive: true })

    const onRelayDataCell = this.#onRelayDataCell.bind(this)
    this.circuit.events.addEventListener("RELAY_DATA", onRelayDataCell, { passive: true })

    const onRelayEndCell = this.#onRelayEndCell.bind(this)
    this.circuit.events.addEventListener("RELAY_END", onRelayEndCell, { passive: true })

    this.#reader = new SuperReadableStream({})

    this.#writer = new SuperWritableStream({
      write: this.#onWrite.bind(this)
    })

    this.readable = this.#reader.start()
    this.writable = this.#writer.start()
  }

  #close(reason?: any) {
    this.#reader.close()
    this.#writer.error(reason)

    this.#reader.closed = { reason }
    this.#writer.closed = { reason }
  }

  async #onCircuitClose(event: CloseEvent) {
    console.debug(`${this.#class.name}.onCircuitClose`, event)

    this.#close(new Error(`Closed`, { cause: event }))
  }

  async #onCircuitError(event: ErrorEvent) {
    console.debug(`${this.#class.name}.onCircuitError`, event)

    this.#close(new Error(`Errored`, { cause: event.error }))
  }

  async #onRelayDataCell(event: MessageEvent<RelayDataCell<Opaque>>) {
    if (event.data.stream !== this) return

    console.debug(`${this.#class.name}.onRelayDataCell`, event)

    this.#reader.enqueue(event.data.data)
  }

  async #onRelayEndCell(event: MessageEvent<RelayEndCell>) {
    if (event.data.stream !== this) return

    console.debug(`${this.#class.name}.onRelayEndCell`, event)

    this.#close(new Error(`Closed`, { cause: event.data.reason }))
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