import { Opaque, Writable } from "@hazae41/binary";
import { SuperReadableStream, SuperWritableStream } from "@hazae41/cascade";
import { Cursor } from "@hazae41/cursor";
import { None, Some } from "@hazae41/option";
import { CloseEvents, ErrorEvents, SuperEventTarget } from "@hazae41/plume";
import { Ok, Result } from "@hazae41/result";
import { Console } from "mods/console/index.js";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { RelayDataCell } from "mods/tor/binary/cells/relayed/relay_data/cell.js";
import { RelayEndCell } from "mods/tor/binary/cells/relayed/relay_end/cell.js";
import { SecretCircuit } from "mods/tor/circuit.js";
import { RelayEndReason } from "./binary/cells/relayed/relay_end/reason.js";
import { RelaySendmeStreamCell } from "./binary/cells/relayed/relay_sendme/cell.js";

export class TorStreamDuplex {

  readonly #secret: SecretTorStreamDuplex

  constructor(secret: SecretTorStreamDuplex) {
    this.#secret = secret
  }

  get outer() {
    return this.#secret.outer
  }

}

export class RelayEndedError extends Error {
  readonly #class = RelayEndedError
  readonly name = this.#class.name

  constructor(
    readonly reason: RelayEndReason
  ) {
    super(`Relay ended`, { cause: reason })
  }

}

export class SecretTorStreamDuplex {
  readonly #class = SecretTorStreamDuplex

  readonly events = {
    input: new SuperEventTarget<CloseEvents & ErrorEvents>(),
    output: new SuperEventTarget<CloseEvents & ErrorEvents>()
  } as const

  readonly #input: SuperReadableStream<Opaque>
  readonly #output: SuperWritableStream<Writable>

  readonly outer: ReadableWritablePair<Opaque, Writable>

  delivery = 500
  package = 500

  #onClean: () => void

  constructor(
    readonly id: number,
    readonly circuit: SecretCircuit
  ) {
    const onClose = this.#onCircuitClose.bind(this)
    const onError = this.#onCircuitError.bind(this)

    const onRelayDataCell = this.#onRelayDataCell.bind(this)
    const onRelayEndCell = this.#onRelayEndCell.bind(this)

    this.circuit.events.on("close", onClose, { passive: true })
    this.circuit.events.on("error", onError, { passive: true })

    this.circuit.events.on("RELAY_DATA", onRelayDataCell, { passive: true })
    this.circuit.events.on("RELAY_END", onRelayEndCell, { passive: true })

    this.#onClean = () => {
      this.circuit.events.off("close", onClose)
      this.circuit.events.off("error", onError)

      this.circuit.events.off("RELAY_DATA", onRelayDataCell)
      this.circuit.events.off("RELAY_END", onRelayEndCell)

      this.#onClean = () => { }
    }

    this.#input = new SuperReadableStream({})

    this.#output = new SuperWritableStream({
      write: this.#onWrite.bind(this)
    })

    const preInputer = this.#input.start()
    const postOutputer = this.#output.start()

    const postInputer = new TransformStream<Opaque, Opaque>({})
    const preOutputer = new TransformStream<Writable, Writable>({})

    /**
     * Outer protocol (TLS? HTTP?)
     */
    this.outer = {
      readable: postInputer.readable,
      writable: preOutputer.writable
    }

    preInputer
      .pipeTo(postInputer.writable)
      .then(() => this.#onInputClose())
      .catch(e => this.#onInputError(e))
      .catch(() => { })

    preOutputer.readable
      .pipeTo(postOutputer)
      .then(() => this.#onOutputClose())
      .catch(e => this.#onOutputError(e))
      .catch(() => { })
  }

  [Symbol.dispose]() {
    this.#onClose()
  }

  #onClose(reason?: unknown) {
    if (this.#input.closed)
      return
    if (this.#output.closed)
      return

    this.#input.close()
    this.#output.error(reason)

    this.#input.closed = { reason }
    this.#output.closed = { reason }

    this.#onClean()
  }

  #onError(reason?: unknown) {
    if (this.#input.closed)
      return
    if (this.#output.closed)
      return

    this.#input.error(reason)
    this.#output.error(reason)

    this.#input.closed = { reason }
    this.#output.closed = { reason }

    this.#onClean()
  }

  async #onInputClose() {
    Console.debug(`${this.#class.name}.onReadClose`)

    this.#input.closed = {}

    if (this.#output.closed)
      this.#onClean()

    await this.events.input.emit("close", [undefined])
  }

  async #onOutputClose() {
    Console.debug(`${this.#class.name}.onWriteClose`)

    this.#output.closed = {}

    if (this.#input.closed)
      this.#onClean()

    await this.events.output.emit("close", [undefined])
  }

  async #onInputError(reason?: unknown) {
    Console.debug(`${this.#class.name}.onReadError`, { reason })

    this.#input.closed = { reason }
    this.#output.error(reason)
    this.#onClean()

    await this.events.input.emit("error", [reason])
  }

  async #onOutputError(reason?: unknown) {
    Console.debug(`${this.#class.name}.onWriteError`, { reason })

    this.#output.closed = { reason }
    this.#input.error(reason)
    this.#onClean()

    await this.events.output.emit("error", [reason])
  }

  async #onCircuitClose() {
    Console.debug(`${this.#class.name}.onCircuitClose`)

    this.#onClose()

    return new None()
  }

  async #onCircuitError(reason?: unknown) {
    Console.debug(`${this.#class.name}.onCircuitError`, { reason })

    this.#onError(reason)

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

      this.#input.tryEnqueue(cell.fragment.fragment).inspectErrSync(e => Console.debug({ e })).ignore()

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

    if (cell.fragment.reason.id === RelayEndCell.reasons.REASON_DONE)
      this.#onClose(new RelayEndedError(cell.fragment.reason))
    else
      this.#onError(new RelayEndedError(cell.fragment.reason))

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