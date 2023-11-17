import { Opaque, Writable } from "@hazae41/binary";
import { SuperReadableStream, SuperWritableStream } from "@hazae41/cascade";
import { Cursor } from "@hazae41/cursor";
import { None, Some } from "@hazae41/option";
import { Ok, Result } from "@hazae41/result";
import { Console } from "mods/console/index.js";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { RelayDataCell } from "mods/tor/binary/cells/relayed/relay_data/cell.js";
import { RelayEndCell } from "mods/tor/binary/cells/relayed/relay_end/cell.js";
import { SecretCircuit } from "mods/tor/circuit.js";
import { RelaySendmeStreamCell } from "./binary/cells/relayed/relay_sendme/cell.js";

export class TorStreamDuplex {

  readonly #secret: SecretTorStreamDuplex

  constructor(secret: SecretTorStreamDuplex) {
    this.#secret = secret
  }

  get readable(): ReadableStream<Opaque> {
    return this.#secret.readable
  }

  get writable(): WritableStream<Writable> {
    return this.#secret.writable
  }

}

export class SecretTorStreamDuplex {
  readonly #class = SecretTorStreamDuplex

  readonly #reader: SuperReadableStream<Opaque>
  readonly #writer: SuperWritableStream<Writable>

  readonly readable: ReadableStream<Opaque>
  readonly writable: WritableStream<Writable>

  delivery = 500
  package = 500

  constructor(
    readonly id: number,
    readonly circuit: SecretCircuit,
    readonly signal?: AbortSignal
  ) {
    const onClose = this.#onCircuitClose.bind(this)
    this.circuit.events.on("close", onClose, { passive: true })

    const onError = this.#onCircuitError.bind(this)
    this.circuit.events.on("error", onError, { passive: true })

    const onRelayDataCell = this.#onRelayDataCell.bind(this)
    this.circuit.events.on("RELAY_DATA", onRelayDataCell, { passive: true })

    const onRelayEndCell = this.#onRelayEndCell.bind(this)
    this.circuit.events.on("RELAY_END", onRelayEndCell, { passive: true })

    this.#reader = new SuperReadableStream({})

    this.#writer = new SuperWritableStream({
      write: this.#onWrite.bind(this)
    })

    this.readable = this.#reader.start()
    this.writable = this.#writer.start()
  }

  #closeOrThrow(reason?: unknown) {
    this.#reader.close()
    this.#writer.error(reason)

    this.#reader.closed = { reason }
    this.#writer.closed = { reason }
  }

  async #onCircuitClose() {
    Console.debug(`${this.#class.name}.onCircuitClose`)

    try {
      this.#closeOrThrow()
    } catch (e: unknown) { }

    return new None()
  }

  async #onCircuitError(reason?: unknown) {
    Console.debug(`${this.#class.name}.onCircuitError`, { reason })

    try {
      this.#closeOrThrow(reason)
    } catch (e: unknown) { }

    return new None()
  }

  async #onRelayDataCell(cell: RelayCell.Streamful<RelayDataCell<Opaque>>) {
    if (cell.stream !== this)
      return new None()

    const result = await Result.unthrow<Result<void, Error>>(async t => {
      Console.debug(`${this.#class.name}.onRelayDataCell`, cell)

      this.delivery--

      if (this.delivery === 450) {
        this.delivery = 500

        const sendme = new RelaySendmeStreamCell()

        const sendme_cell = RelayCell.Streamful.from(this.circuit, this, sendme)
        this.circuit.tor.output.tryEnqueue(sendme_cell.cellOrThrow()).throw(t)
      }

      this.#reader.tryEnqueue(cell.fragment.fragment).inspectErrSync(e => Console.debug({ e })).ignore()

      return Ok.void()
    })

    if (result.isErr())
      return new Some(result)

    return new None()
  }

  async #onRelayEndCell(cell: RelayCell.Streamful<RelayEndCell>) {
    if (cell.stream !== this)
      return new None()

    Console.debug(`${this.#class.name}.onRelayEndCell`, cell)

    try {
      this.#closeOrThrow(cell.fragment.reason)
    } catch (e: unknown) { }

    return new None()
  }

  #onWrite(writable: Writable) {
    if (writable.sizeOrThrow() > RelayCell.DATA_LEN)
      return this.#onWriteChunked(writable)
    return this.#onWriteDirect(writable)
  }

  #onWriteDirect(writable: Writable) {
    const relay_data_cell = new RelayDataCell(writable)
    const relay_cell = RelayCell.Streamful.from(this.circuit, this, relay_data_cell)
    const cell = relay_cell.cellOrThrow()
    this.circuit.tor.output.enqueue(cell)

    this.package--
  }

  #onWriteChunked(writable: Writable) {
    const bytes = Writable.writeToBytesOrThrow(writable)
    const cursor = new Cursor(bytes)

    for (const chunk of cursor.splitOrThrow(RelayCell.DATA_LEN))
      this.#onWriteDirect(new Opaque(chunk))

    return
  }

}