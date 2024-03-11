import { Opaque, Writable } from "@hazae41/binary";
import { FullDuplex, OpenEvents } from "@hazae41/cascade";
import { Cursor } from "@hazae41/cursor";
import { None } from "@hazae41/option";
import { CloseEvents, ErrorEvents, SuperEventTarget } from "@hazae41/plume";
import { Console } from "mods/console/index.js";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { RelayDataCell } from "mods/tor/binary/cells/relayed/relay_data/cell.js";
import { RelayEndCell } from "mods/tor/binary/cells/relayed/relay_end/cell.js";
import { SecretCircuit } from "mods/tor/circuit.js";
import { RelayConnectedCell } from "./binary/cells/relayed/relay_connected/cell.js";
import { RelayEndReason, RelayEndReasonOther } from "./binary/cells/relayed/relay_end/reason.js";
import { RelaySendmeStreamCell } from "./binary/cells/relayed/relay_sendme/cell.js";

export class TorStreamDuplex {

  readonly #secret: SecretTorStreamDuplex

  constructor(secret: SecretTorStreamDuplex) {
    this.#secret = secret
  }

  [Symbol.dispose]() {
    this.close().catch(console.error)
  }

  async [Symbol.asyncDispose]() {
    await this.close()
  }

  get id() {
    return this.#secret.id
  }

  get type() {
    return this.#secret.type
  }

  get inner() {
    return this.#secret.inner
  }

  get outer() {
    return this.#secret.outer
  }

  async error(reason?: unknown) {
    await this.#secret.error(reason)
  }

  async close() {
    await this.#secret.close()
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

export type TorStreamEvents =
  & OpenEvents
  & CloseEvents
  & ErrorEvents

export type SecretTorStreamDuplexType =
  | "external"
  | "directory"

export class SecretTorStreamDuplex {
  readonly #class = SecretTorStreamDuplex

  readonly duplex = new FullDuplex<Opaque, Writable>()
  readonly events = new SuperEventTarget<TorStreamEvents>()

  delivery = 500
  package = 500

  #onClean: () => void

  constructor(
    readonly type: SecretTorStreamDuplexType,
    readonly id: number,
    readonly circuit: SecretCircuit
  ) {
    this.duplex.events.on("close", () => this.events.emit("close"))
    this.duplex.events.on("error", e => this.events.emit("error", e))

    this.duplex.events.on("close", async () => {
      await this.#onDuplexClose()
      return new None()
    })

    this.duplex.events.on("error", async e => {
      await this.#onDuplexError(e)
      return new None()
    })

    this.duplex.output.events.on("message", async chunk => {
      await this.#onOutputWrite(chunk)
      return new None()
    })

    const onCircuitClose = this.#onCircuitClose.bind(this)
    const onCircuitError = this.#onCircuitError.bind(this)

    const onRelayConnectedCell = this.#onRelayConnectedCell.bind(this)
    const onRelayDataCell = this.#onRelayDataCell.bind(this)
    const onRelayEndCell = this.#onRelayEndCell.bind(this)

    this.circuit.events.on("close", onCircuitClose, { passive: true })
    this.circuit.events.on("error", onCircuitError, { passive: true })

    this.circuit.events.on("RELAY_CONNECTED", onRelayConnectedCell, { passive: true })
    this.circuit.events.on("RELAY_DATA", onRelayDataCell, { passive: true })
    this.circuit.events.on("RELAY_END", onRelayEndCell, { passive: true })

    this.#onClean = () => {
      this.circuit.events.off("close", onCircuitClose)
      this.circuit.events.off("error", onCircuitError)

      this.circuit.events.off("RELAY_CONNECTED", onRelayConnectedCell)
      this.circuit.events.off("RELAY_DATA", onRelayDataCell)
      this.circuit.events.off("RELAY_END", onRelayEndCell)

      this.circuit.streams.delete(this.id)

      this.#onClean = () => { }
    }
  }

  [Symbol.dispose]() {
    this.close().catch(console.error)
  }

  async [Symbol.asyncDispose]() {
    await this.close()
  }

  get inner() {
    return this.duplex.inner
  }

  get outer() {
    return this.duplex.outer
  }

  get input() {
    return this.duplex.input
  }

  get output() {
    return this.duplex.output
  }

  get closed() {
    return this.duplex.closed
  }

  async close() {
    await this.duplex.close()
  }

  async error(reason?: unknown) {
    await this.duplex.error(reason)
  }

  async #onDuplexClose() {
    if (!this.circuit.closed) {
      const relay_end_cell = new RelayEndCell(new RelayEndReasonOther(RelayEndCell.reasons.REASON_DONE))
      const relay_cell = RelayCell.Streamful.from(this.circuit, this, relay_end_cell)
      await this.circuit.tor.output.enqueue(relay_cell.cellOrThrow())

      this.package--
    }

    this.#onClean()
  }

  async #onDuplexError(reason?: unknown) {
    if (!this.circuit.closed) {
      const relay_end_cell = new RelayEndCell(new RelayEndReasonOther(RelayEndCell.reasons.REASON_MISC))
      const relay_cell = RelayCell.Streamful.from(this.circuit, this, relay_end_cell)
      await this.circuit.tor.output.enqueue(relay_cell.cellOrThrow())

      this.package--
    }

    this.#onClean()
  }

  async #onCircuitClose() {
    Console.debug(`${this.#class.name}.onCircuitClose`)

    if (this.duplex.closing)
      return new None()

    await this.duplex.close()

    return new None()
  }

  async #onCircuitError(reason?: unknown) {
    Console.debug(`${this.#class.name}.onCircuitError`, { reason })

    if (this.duplex.closing)
      return new None()

    await this.duplex.error(reason)

    return new None()
  }

  async #onRelayConnectedCell(cell: RelayCell.Streamful<Opaque>) {
    if (cell.stream !== this)
      return new None()
    if (this.type === "directory")
      return new None()

    const cell2 = RelayCell.Streamful.intoOrThrow(cell, RelayConnectedCell)

    Console.debug(`${this.#class.name}.onRelayConnectedCell`, cell2)

    await this.events.emit("open")

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
      await this.circuit.tor.output.enqueue(sendme_cell.cellOrThrow())
    }

    await this.input.enqueue(cell.fragment.fragment)

    return new None()
  }

  async #onRelayEndCell(cell: RelayCell.Streamful<RelayEndCell>) {
    if (cell.stream !== this)
      return new None()

    Console.debug(`${this.#class.name}.onRelayEndCell`, cell)

    if (this.duplex.closing)
      return new None()

    if (cell.fragment.reason.id === RelayEndCell.reasons.REASON_DONE)
      await this.duplex.close()
    else
      await this.duplex.error(new RelayEndedError(cell.fragment.reason))

    return new None()
  }

  async #onOutputWrite(writable: Writable) {
    if (writable.sizeOrThrow() > RelayCell.DATA_LEN)
      return await this.#onWriteChunked(writable)

    return await this.#onWriteDirect(writable)
  }

  async #onWriteDirect(writable: Writable) {
    const relay_data_cell = new RelayDataCell(writable)
    const relay_cell = RelayCell.Streamful.from(this.circuit, this, relay_data_cell)

    await this.circuit.tor.output.enqueue(relay_cell.cellOrThrow())

    this.package--
  }

  async #onWriteChunked(writable: Writable) {
    const bytes = Writable.writeToBytesOrThrow(writable)
    const cursor = new Cursor(bytes)

    for (const chunk of cursor.splitOrThrow(RelayCell.DATA_LEN))
      await this.#onWriteDirect(new Opaque(chunk))

    return
  }

}