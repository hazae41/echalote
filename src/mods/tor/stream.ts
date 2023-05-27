import { BinaryError, BinaryWriteError, Opaque, Writable } from "@hazae41/binary";
import { ControllerError, SuperReadableStream, SuperWritableStream } from "@hazae41/cascade";
import { Cursor } from "@hazae41/cursor";
import { Ok, Result } from "@hazae41/result";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { RelayDataCell } from "mods/tor/binary/cells/relayed/relay_data/cell.js";
import { RelayEndCell } from "mods/tor/binary/cells/relayed/relay_end/cell.js";
import { SecretCircuit } from "mods/tor/circuit.js";

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

  #tryClose(reason?: unknown): Result<void, ControllerError> {
    return Result.unthrowSync(t => {
      this.#reader.tryClose().throw(t)
      this.#writer.tryError(reason).throw(t)

      this.#reader.closed = { reason }
      this.#writer.closed = { reason }

      return Ok.void()
    })
  }

  async #onCircuitClose() {
    console.debug(`${this.#class.name}.onCircuitClose`)

    this.#tryClose().inspectErrSync(console.warn).ignore()

    return Ok.void()
  }

  async #onCircuitError(reason?: unknown) {
    console.debug(`${this.#class.name}.onCircuitError`, reason)

    this.#tryClose(reason).inspectErrSync(console.warn).ignore()

    return Ok.void()
  }

  async #onRelayDataCell(cell: RelayCell.Streamful<RelayDataCell<Opaque>>) {
    if (cell.stream !== this)
      return Ok.void()

    console.debug(`${this.#class.name}.onRelayDataCell`, cell)

    this.#reader.tryEnqueue(cell.fragment.fragment).inspectErrSync(console.warn).ignore()

    return Ok.void()
  }

  async #onRelayEndCell(cell: RelayCell.Streamful<RelayEndCell>) {
    if (cell.stream !== this)
      return Ok.void()

    console.debug(`${this.#class.name}.onRelayEndCell`, cell)

    this.#tryClose(cell.fragment.reason).inspectErrSync(console.warn).ignore()

    return Ok.void()
  }

  #onWrite<T extends Writable.Infer<T>>(writable: T): Result<void, BinaryError | Writable.SizeError<T> | Writable.WriteError<T>> {
    return Result.unthrowSync(t => {
      if (writable.trySize().throw(t) <= RelayCell.DATA_LEN)
        return this.#onWriteDirect(writable)
      else
        return this.#onWriteChunked(writable)
    })
  }

  #onWriteDirect<T extends Writable.Infer<T>>(writable: T): Result<void, BinaryWriteError | Writable.SizeError<T> | Writable.WriteError<T>> {
    return Result.unthrowSync(t => {
      const relay_data_cell = new RelayDataCell(writable)
      const relay_cell = RelayCell.Streamful.from(this.circuit, this, relay_data_cell)
      const cell = relay_cell.tryCell().throw(t)
      this.circuit.tor.writer.enqueue(cell)

      return Ok.void()
    })
  }

  #onWriteChunked<T extends Writable.Infer<T>>(writable: T): Result<void, BinaryError | Writable.SizeError<T> | Writable.WriteError<T>> {
    return Result.unthrowSync(t => {
      const bytes = Writable.tryWriteToBytes(writable).throw(t)
      const cursor = new Cursor(bytes)

      const iterator = cursor.trySplit(RelayCell.DATA_LEN)

      let next = iterator.next()

      for (; !next.done; next = iterator.next())
        this.#onWriteDirect(new Opaque(next.value)).throw(t)

      return next.value
    })
  }
}