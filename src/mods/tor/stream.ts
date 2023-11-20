import { Opaque, Writable } from "@hazae41/binary";
import { SuperReadableStream, SuperWritableStream } from "@hazae41/cascade";
import { Cursor } from "@hazae41/cursor";
import { None } from "@hazae41/option";
import { CloseEvents, ErrorEvents, SuperEventTarget } from "@hazae41/plume";
import { Console } from "mods/console/index.js";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { RelayDataCell } from "mods/tor/binary/cells/relayed/relay_data/cell.js";
import { RelayEndCell } from "mods/tor/binary/cells/relayed/relay_end/cell.js";
import { SecretCircuit } from "mods/tor/circuit.js";
import { RelayEndReason, RelayEndReasonOther } from "./binary/cells/relayed/relay_end/reason.js";
import { RelaySendmeStreamCell } from "./binary/cells/relayed/relay_sendme/cell.js";
import { RelayConnectedCell } from "./index.js";

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

export type StreamEvents = CloseEvents & ErrorEvents & {
  "open": () => void
}

export type SecretTorStreamDuplexType =
  | "external"
  | "directory"

export class SecretTorStreamDuplex {
  readonly #class = SecretTorStreamDuplex

  readonly events = {
    input: new SuperEventTarget<StreamEvents>(),
    output: new SuperEventTarget<StreamEvents>()
  } as const

  readonly #input: SuperReadableStream<Opaque>
  readonly #output: SuperWritableStream<Writable>

  readonly outer: ReadableWritablePair<Opaque, Writable>

  delivery = 500
  package = 500

  #onClean: () => void

  constructor(
    readonly type: SecretTorStreamDuplexType,
    readonly id: number,
    readonly circuit: SecretCircuit
  ) {
    const onClose = this.#onCircuitClose.bind(this)
    const onError = this.#onCircuitError.bind(this)

    const onRelayConnectedCell = this.#onRelayConnectedCell.bind(this)
    const onRelayDataCell = this.#onRelayDataCell.bind(this)
    const onRelayEndCell = this.#onRelayEndCell.bind(this)

    this.circuit.events.on("close", onClose, { passive: true })
    this.circuit.events.on("error", onError, { passive: true })

    this.circuit.events.on("RELAY_CONNECTED", onRelayConnectedCell, { passive: true })
    this.circuit.events.on("RELAY_DATA", onRelayDataCell, { passive: true })
    this.circuit.events.on("RELAY_END", onRelayEndCell, { passive: true })

    this.#onClean = () => {
      this.circuit.events.off("close", onClose)
      this.circuit.events.off("error", onError)

      this.circuit.events.off("RELAY_CONNECTED", onRelayConnectedCell)
      this.circuit.events.off("RELAY_DATA", onRelayDataCell)
      this.circuit.events.off("RELAY_END", onRelayEndCell)

      this.circuit.streams.delete(this.id)

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
    if (!this.#input.closed) {
      this.#input.close()
      this.#input.closed = { reason }
    }

    if (!this.#output.closed) {
      this.#output.error(reason)
      this.#output.closed = { reason }
    }

    this.#onClean()
  }

  #onError(reason?: unknown) {
    if (!this.#input.closed) {
      this.#input.error(reason)
      this.#input.closed = { reason }
    }

    if (!this.#output.closed) {
      this.#output.error(reason)
      this.#output.closed = { reason }
    }

    this.#onClean()
  }

  async #onInputClose() {
    Console.debug(`${this.#class.name}.onReadClose`)

    this.#input.closed = {}

    if (this.#output.closed && !this.#input.closed) {
      const relay_end_cell = new RelayEndCell(new RelayEndReasonOther(RelayEndCell.reasons.REASON_DONE))
      const relay_cell = RelayCell.Streamful.from(this.circuit, this, relay_end_cell)
      this.circuit.tor.output.enqueue(relay_cell.cellOrThrow())

      this.#onClean()
    }

    await this.events.input.emit("close", [undefined])
  }

  async #onOutputClose() {
    Console.debug(`${this.#class.name}.onWriteClose`)

    if (this.#input.closed && !this.#output.closed) {
      const relay_end_cell = new RelayEndCell(new RelayEndReasonOther(RelayEndCell.reasons.REASON_DONE))
      const relay_cell = RelayCell.Streamful.from(this.circuit, this, relay_end_cell)
      this.circuit.tor.output.enqueue(relay_cell.cellOrThrow())

      this.#onClean()
    }

    this.#output.closed = {}

    await this.events.output.emit("close", [undefined])
  }

  async #onInputError(reason?: unknown) {
    Console.debug(`${this.#class.name}.onReadError`, { reason })

    if (!this.#input.closed || !this.#output.closed) {
      const relay_end_cell = new RelayEndCell(new RelayEndReasonOther(RelayEndCell.reasons.REASON_MISC))
      const relay_cell = RelayCell.Streamful.from(this.circuit, this, relay_end_cell)
      this.circuit.tor.output.enqueue(relay_cell.cellOrThrow())

      this.#onClean()
    }

    this.#input.closed = { reason }
    this.#output.error(reason)

    await this.events.input.emit("error", [reason])
  }

  async #onOutputError(reason?: unknown) {
    Console.debug(`${this.#class.name}.onWriteError`, { reason })

    if (!this.#input.closed || !this.#output.closed) {
      const relay_end_cell = new RelayEndCell(new RelayEndReasonOther(RelayEndCell.reasons.REASON_MISC))
      const relay_cell = RelayCell.Streamful.from(this.circuit, this, relay_end_cell)
      this.circuit.tor.output.enqueue(relay_cell.cellOrThrow())

      this.#onClean()
    }

    this.#output.closed = { reason }
    this.#input.error(reason)

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

  async #onRelayConnectedCell(cell: RelayCell.Streamful<Opaque>) {
    if (cell.stream !== this)
      return new None()
    if (this.type === "directory")
      return new None()

    const cell2 = RelayCell.Streamful.intoOrThrow(cell, RelayConnectedCell)

    Console.debug(`${this.#class.name}.onRelayConnectedCell`, cell2)

    await this.events.input.emit("open", [])
    await this.events.output.emit("open", [])

    return new None()
  }

  async #onRelayDataCell(cell: RelayCell.Streamful<RelayDataCell<Opaque>>) {
    if (cell.stream !== this)
      return new None()

    Console.debug(`${this.#class.name}.onRelayDataCell`, cell)

    this.delivery--

    if (this.delivery === 450) {
      this.delivery = 500

      const sendme = new RelaySendmeStreamCell()
      const sendme_cell = RelayCell.Streamful.from(this.circuit, this, sendme)
      this.circuit.tor.output.enqueue(sendme_cell.cellOrThrow())
    }

    this.#input.enqueue(cell.fragment.fragment)

    return new None()
  }

  async #onRelayEndCell(cell: RelayCell.Streamful<RelayEndCell>) {
    if (cell.stream !== this)
      return new None()

    if (this.#input.closed && this.#output.closed)
      console.warn("RelayEndCell received but stream already closed")

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
    this.circuit.tor.output.enqueue(relay_cell.cellOrThrow())

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