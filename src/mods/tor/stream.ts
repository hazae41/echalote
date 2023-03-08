import { Cursor, Opaque, Writable } from "@hazae41/binary";
import { SuperReadableStream } from "libs/streams/readable.js";
import { SuperWritableStream } from "libs/streams/writable.js";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { RelayDataCell } from "mods/tor/binary/cells/relayed/relay_data/cell.js";
import { RelayEndCell } from "mods/tor/binary/cells/relayed/relay_end/cell.js";
import { SecretCircuit } from "mods/tor/circuit.js";

export class TorStreamDuplex {
  readonly #class = TorStreamDuplex

  readonly #reader: SuperReadableStream<Opaque>
  readonly #writer: SuperWritableStream<Writable>

  readonly readable: ReadableStream<Opaque>
  readonly writable: WritableStream<Writable>

  constructor(
    readonly id: number,
    readonly circuit: SecretCircuit,
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
    try {
      this.#reader.close()
    } catch (e: unknown) { }

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

    try {
      this.#reader.enqueue(event.data.data)
    } catch (e: unknown) { }
  }

  async #onRelayEndCell(event: MessageEvent<RelayEndCell>) {
    if (event.data.stream !== this) return

    console.debug(`${this.#class.name}.onRelayEndCell`, event)

    this.#close(new Error(`Closed`, { cause: event.data.reason }))
  }

  async #onWrite(writable: Writable) {
    if (writable.size() <= RelayCell.DATA_LEN)
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

    for (const chunk of cursor.split(RelayCell.DATA_LEN)) {
      this.#onWriteDirect(new Opaque(chunk))
    }
  }
}