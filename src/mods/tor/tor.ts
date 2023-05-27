import { ASN1Error, DERReadError } from "@hazae41/asn1";
import { BinaryError, BinaryReadError, Opaque, Readable, Writable } from "@hazae41/binary";
import { Bitset } from "@hazae41/bitset";
import { Bytes } from "@hazae41/bytes";
import { TlsClientDuplex } from "@hazae41/cadenas";
import { Cascade, SuperTransformStream } from "@hazae41/cascade";
import { Cursor } from "@hazae41/cursor";
import type { Ed25519 } from "@hazae41/ed25519";
import { Mutex } from "@hazae41/mutex";
import { None, Some } from "@hazae41/option";
import { Paimon } from "@hazae41/paimon";
import { AbortError, CloseError, ErrorError, EventError, Plume, StreamEvents, SuperEventTarget } from "@hazae41/plume";
import { Err, Ok, Panic, Result } from "@hazae41/result";
import type { Sha1 } from "@hazae41/sha1";
import type { X25519 } from "@hazae41/x25519";
import { Aes128Ctr128BEKey, Zepar } from "@hazae41/zepar";
import { AbortSignals } from "libs/signals/signals.js";
import { TypedAddress } from "mods/tor/binary/address.js";
import { Cell } from "mods/tor/binary/cells/cell.js";
import { AuthChallengeCell } from "mods/tor/binary/cells/direct/auth_challenge/cell.js";
import { CertsCell } from "mods/tor/binary/cells/direct/certs/cell.js";
import { CreateFastCell } from "mods/tor/binary/cells/direct/create_fast/cell.js";
import { CreatedFastCell } from "mods/tor/binary/cells/direct/created_fast/cell.js";
import { DestroyCell } from "mods/tor/binary/cells/direct/destroy/cell.js";
import { NetinfoCell } from "mods/tor/binary/cells/direct/netinfo/cell.js";
import { PaddingCell } from "mods/tor/binary/cells/direct/padding/cell.js";
import { PaddingNegociateCell } from "mods/tor/binary/cells/direct/padding_negociate/cell.js";
import { RelayCell } from "mods/tor/binary/cells/direct/relay/cell.js";
import { VersionsCell } from "mods/tor/binary/cells/direct/versions/cell.js";
import { VariablePaddingCell } from "mods/tor/binary/cells/direct/vpadding/cell.js";
import { RelayConnectedCell } from "mods/tor/binary/cells/relayed/relay_connected/cell.js";
import { RelayDataCell } from "mods/tor/binary/cells/relayed/relay_data/cell.js";
import { RelayDropCell } from "mods/tor/binary/cells/relayed/relay_drop/cell.js";
import { RelayEndCell } from "mods/tor/binary/cells/relayed/relay_end/cell.js";
import { RelayExtended2Cell } from "mods/tor/binary/cells/relayed/relay_extended2/cell.js";
import { RelayTruncatedCell } from "mods/tor/binary/cells/relayed/relay_truncated/cell.js";
import { TorCiphers } from "mods/tor/ciphers.js";
import { Circuit, SecretCircuit } from "mods/tor/circuit.js";
import { Authority, parseAuthorities } from "mods/tor/consensus/authorities.js";
import { Target } from "mods/tor/target.js";
import { KDFTorResult } from "./algorithms/kdftor.js";
import { InvalidCircuitError, InvalidCommandError, InvalidStreamError } from "./binary/cells/errors.js";
import { OldCell } from "./binary/cells/old.js";
import { CertError, Certs } from "./certs/certs.js";

export type TorState =
  | TorNoneState
  | TorVersionedState
  | TorHandshakingState
  | TorHandshakedState

export interface TorNoneState {
  readonly type: "none"
}

export interface TorVersionedState {
  readonly type: "versioned",
  readonly version: number
}

export interface TorHandshakingState {
  readonly type: "handshaking",
  readonly version: number
  readonly guard: Guard
}

export interface TorHandshakedState {
  readonly type: "handshaked",
  readonly version: number
  readonly guard: Guard
}

export interface Guard {
  readonly idh: Uint8Array
  readonly certs: Certs
}

export interface Fallback {
  readonly id: string,
  readonly eid?: string,
  readonly exit?: boolean,
  readonly onion: number[]
  readonly hosts: string[]
}

export interface TorClientParams {
  readonly ed25519: Ed25519.Adapter
  readonly x25519: X25519.Adapter
  readonly sha1: Sha1.Adapter
  readonly fallbacks: Fallback[]
  readonly signal?: AbortSignal
}

export class TorClientDuplex {

  readonly #secret: SecretTorClientDuplex

  constructor(
    readonly tcp: ReadableWritablePair<Opaque, Writable>,
    readonly params: TorClientParams
  ) {
    this.#secret = new SecretTorClientDuplex(tcp, params)
  }

  async tryCreateAndExtendLoop(signal?: AbortSignal) {
    return await this.#secret.tryCreateAndExtendLoop(signal)
  }

  async tryCreateLoop(signal?: AbortSignal) {
    return await this.#secret.tryCreateLoop(signal)
  }

  async tryCreate(signal?: AbortSignal) {
    return await this.#secret.tryCreate(signal)
  }

}

export type SecretTorEvents = StreamEvents & {
  "handshaked": undefined,

  "CREATED_FAST": Cell.Circuitful<CreatedFastCell>
  "DESTROY": Cell.Circuitful<DestroyCell>
  "RELAY_CONNECTED": RelayCell.Streamful<RelayConnectedCell>
  "RELAY_DATA": RelayCell.Streamful<RelayDataCell<Opaque>>
  "RELAY_EXTENDED2": RelayCell.Streamless<RelayExtended2Cell<Opaque>>
  "RELAY_TRUNCATED": RelayCell.Streamless<RelayTruncatedCell>
  "RELAY_END": RelayCell.Streamful<RelayEndCell>
}

export class SecretTorClientDuplex {
  readonly #class = SecretTorClientDuplex

  readonly events = new SuperEventTarget<SecretTorEvents>()

  readonly reader: SuperTransformStream<Opaque, Opaque>
  readonly writer: SuperTransformStream<Writable, Writable>

  readonly authorities = new Array<Authority>()
  readonly circuits = new Mutex(new Map<number, SecretCircuit>())

  readonly #buffer = Cursor.allocUnsafe(65535)

  #state: TorState = { type: "none" }

  /**
   * Create a new Tor client
   * @param tcp Some TCP stream
   * @param params Tor params
   */
  constructor(
    readonly tcp: ReadableWritablePair<Opaque, Writable>,
    readonly params: TorClientParams
  ) {
    const { signal } = params

    this.authorities = parseAuthorities()

    const ciphers = Object.values(TorCiphers)
    const tls = new TlsClientDuplex(tcp, { signal, ciphers })

    this.reader = new SuperTransformStream({
      transform: this.#onRead.bind(this)
    })

    this.writer = new SuperTransformStream({
      start: this.#onWriteStart.bind(this)
    })

    const read = this.reader.start()
    const write = this.writer.start()

    tls.readable
      .pipeTo(read.writable, { signal })
      .then(this.#onReadClose.bind(this))
      .catch(this.#onReadError.bind(this))
      .then(r => r.ignore())
      .catch(console.error)

    write.readable
      .pipeTo(tls.writable, { signal })
      .then(this.#onWriteClose.bind(this))
      .catch(this.#onWriteError.bind(this))
      .then(r => r.ignore())
      .catch(console.error)

    read.readable
      .pipeTo(new WritableStream())
      .then(() => { })
      .catch(() => { })
  }

  async #init() {
    await Paimon.initBundledOnce()
    await Zepar.initBundledOnce()
  }

  get closed() {
    return this.reader.closed
  }

  async #onReadClose() {
    console.debug(`${this.#class.name}.onReadClose`)

    this.reader.closed = {}

    await this.events.emit("close", undefined)

    return Ok.void()
  }

  async #onWriteClose() {
    console.debug(`${this.#class.name}.onWriteClose`)

    this.writer.closed = {}

    return Ok.void()
  }

  async #onReadError(reason?: unknown) {
    console.debug(`${this.#class.name}.onReadError`, { reason })

    this.reader.closed = { reason }
    this.writer.error(reason)

    await this.events.emit("error", reason)

    return Cascade.rethrow(reason)
  }

  async #onWriteError(reason?: unknown) {
    console.debug(`${this.#class.name}.onWriteError`, { reason })

    this.writer.closed = { reason }
    this.reader.error(reason)

    return Cascade.rethrow(reason)
  }

  async #onWriteStart(): Promise<Result<void, AbortError | ErrorError | CloseError>> {
    await this.#init()

    const version = new VersionsCell([5])
    this.writer.enqueue(OldCell.Circuitless.from(undefined, version))

    return await Plume.tryWaitStream(this.events, "handshaked", () => {
      return new Ok(new Some(Ok.void()))
    }, AbortSignal.timeout(1000))
  }

  async #onRead(chunk: Opaque): Promise<Result<void, Panic | BinaryError | InvalidCommandError | InvalidCircuitError | InvalidStreamError | DERReadError | ASN1Error | CertError | EventError>> {
    // console.debug(this.#class.name, "<-", chunk)

    if (this.#buffer.offset)
      return await this.#onReadBuffered(chunk.bytes)
    else
      return await this.#onReadDirect(chunk.bytes)
  }

  /**
   * Read from buffer
   * @param chunk 
   * @returns 
   */
  async #onReadBuffered(chunk: Uint8Array): Promise<Result<void, Panic | BinaryError | InvalidCommandError | InvalidCircuitError | InvalidStreamError | DERReadError | ASN1Error | CertError | EventError>> {
    return await Result.unthrow(async t => {
      this.#buffer.tryWrite(chunk).throw(t)
      const full = this.#buffer.before

      this.#buffer.offset = 0
      return await this.#onReadDirect(full)
    })
  }

  /**
   * Zero-copy reading
   * @param chunk 
   * @returns 
   */
  async #onReadDirect(chunk: Uint8Array): Promise<Result<void, Panic | BinaryError | InvalidCommandError | InvalidCircuitError | InvalidStreamError | DERReadError | ASN1Error | CertError | EventError>> {
    return await Result.unthrow(async t => {
      const cursor = new Cursor(chunk)

      while (cursor.remaining) {
        const raw = this.#state.type === "none"
          ? Readable.tryReadOrRollback(OldCell.Raw, cursor).ignore()
          : Readable.tryReadOrRollback(Cell.Raw, cursor).ignore()

        if (raw.isErr()) {
          this.#buffer.tryWrite(cursor.after).throw(t)
          break
        }

        const cell = raw.get().tryUnpack(this).throw(t)
        await this.#onCell(cell).then(r => r.throw(t))
      }

      return Ok.void()
    })
  }

  async #onCell(cell: Cell<Opaque> | OldCell<Opaque>): Promise<Result<void, Panic | BinaryError | InvalidCommandError | InvalidCircuitError | InvalidStreamError | DERReadError | ASN1Error | CertError | EventError>> {
    if (cell.command === PaddingCell.command)
      return new Ok(console.debug(`PADDING`, cell))
    if (cell.command === VariablePaddingCell.command)
      return new Ok(console.debug(`VPADDING`, cell))

    if (this.#state.type === "none")
      return await this.#onNoneStateCell(cell)
    if (cell instanceof OldCell.Circuitful)
      return new Err(new Panic(`Invalid cell`))
    if (cell instanceof OldCell.Circuitless)
      return new Err(new Panic(`Invalid cell`))

    if (this.#state.type === "versioned")
      return await this.#onVersionedStateCell(cell)
    if (this.#state.type === "handshaking")
      return await this.#onHandshakingStateCell(cell)
    if (this.#state.type === "handshaked")
      return await this.#onHandshakedStateCell(cell)

    throw new Panic()
  }

  async #onNoneStateCell(cell: Cell<Opaque> | OldCell<Opaque>): Promise<Result<void, Panic | BinaryReadError | InvalidCommandError | InvalidCircuitError>> {
    if (this.#state.type !== "none")
      return new Err(new Panic(`Invalid state`))
    if (cell instanceof Cell.Circuitful)
      return new Err(new Panic(`Invalid cell`))
    if (cell instanceof Cell.Circuitless)
      return new Err(new Panic(`Invalid cell`))

    if (cell.command === VersionsCell.command)
      return await this.#onVersionsCell(cell)

    console.debug(`Unknown pre-version cell ${cell.command}`)
    return Ok.void()
  }

  async #onVersionedStateCell(cell: Cell<Opaque>): Promise<Result<void, Panic | BinaryError | InvalidCommandError | InvalidCircuitError | DERReadError | ASN1Error | CertError>> {
    if (this.#state.type !== "versioned")
      return new Err(new Panic(`Invalid state`))

    if (cell.command === CertsCell.command)
      return await this.#onCertsCell(cell)

    console.debug(`Unknown versioned-state cell ${cell.command}`)
    return Ok.void()
  }

  async #onHandshakingStateCell(cell: Cell<Opaque>): Promise<Result<void, Panic | BinaryReadError | InvalidCommandError | InvalidCircuitError | EventError>> {
    if (this.#state.type !== "handshaking")
      throw new Error(`State is not handshaking`)

    if (cell.command === AuthChallengeCell.command)
      return await this.#onAuthChallengeCell(cell)
    if (cell.command === NetinfoCell.command)
      return await this.#onNetinfoCell(cell)

    console.debug(`Unknown handshaking-state cell ${cell.command}`)
    return Ok.void()
  }

  async #onHandshakedStateCell(cell: Cell<Opaque>): Promise<Result<void, Panic | BinaryError | InvalidCommandError | InvalidCircuitError | InvalidStreamError | EventError>> {
    if (cell.command === CreatedFastCell.command)
      return await this.#onCreatedFastCell(cell)
    if (cell.command === DestroyCell.command)
      return await this.#onDestroyCell(cell)
    if (cell.command === RelayCell.command)
      return await this.#onRelayCell(cell)

    console.debug(`Unknown handshaked-state cell ${cell.command}`)
    return Ok.void()
  }

  async #onVersionsCell(cell: OldCell<Opaque>): Promise<Result<void, Panic | BinaryReadError | InvalidCommandError | InvalidCircuitError>> {
    return await Result.unthrow(async t => {
      if (this.#state.type !== "none")
        return new Err(new Panic(`Invalid state`))

      const cell2 = OldCell.Circuitless.tryInto(cell, VersionsCell).inspectSync(console.debug).throw(t)

      if (!cell2.fragment.versions.includes(5))
        return new Err(new Panic(`Invalid version`))

      this.#state = { type: "versioned", version: 5 }

      return Ok.void()
    })
  }

  async #onCertsCell(cell: Cell<Opaque>): Promise<Result<void, Panic | BinaryError | InvalidCommandError | InvalidCircuitError | DERReadError | ASN1Error | CertError>> {
    return await Result.unthrow(async t => {
      if (this.#state.type !== "versioned")
        return new Err(new Panic(`Invalid state`))

      const cell2 = Cell.Circuitless.tryInto(cell, CertsCell).inspectSync(console.debug).throw(t)

      const certs = await Certs.tryVerify(cell2.fragment.certs, this.params.ed25519).then(r => r.throw(t))

      const idh = await certs.rsa_self.tryHash().then(r => r.throw(t))
      const guard = { certs, idh }

      const { version } = this.#state
      this.#state = { type: "handshaking", version, guard }

      return Ok.void()
    })
  }

  async #onAuthChallengeCell(cell: Cell<Opaque>): Promise<Result<void, Panic | BinaryReadError | InvalidCommandError | InvalidCircuitError>> {
    if (this.#state.type !== "handshaking")
      return new Err(new Panic(`Invalid state`))

    return Cell.Circuitless.tryInto(cell, AuthChallengeCell).inspectSync(console.debug).clear()
  }

  async #onNetinfoCell(cell: Cell<Opaque>): Promise<Result<void, Panic | BinaryReadError | InvalidCommandError | InvalidCircuitError | EventError>> {
    return await Result.unthrow(async t => {
      if (this.#state.type !== "handshaking")
        return new Err(new Panic(`Invalid state`))

      Cell.Circuitless.tryInto(cell, NetinfoCell).inspectSync(console.debug).throw(t)

      const address = new TypedAddress(4, new Uint8Array([127, 0, 0, 1]))
      const netinfo = new NetinfoCell(0, address, [])
      this.writer.enqueue(Cell.Circuitless.from(undefined, netinfo))

      const pversion = PaddingNegociateCell.versions.ZERO
      const pcommand = PaddingNegociateCell.commands.STOP
      const padding_negociate = new PaddingNegociateCell(pversion, pcommand, 0, 0)
      this.writer.enqueue(Cell.Circuitless.from(undefined, padding_negociate))

      const { version, guard } = this.#state
      this.#state = { type: "handshaked", version, guard }

      await this.events.tryEmit("handshaked", undefined).then(r => r.throw(t))

      return Ok.void()
    })
  }

  async #onCreatedFastCell(cell: Cell<Opaque>): Promise<Result<void, Panic | BinaryReadError | InvalidCommandError | InvalidCircuitError | EventError>> {
    return await Result.unthrow(async t => {
      const cell2 = Cell.Circuitful.tryInto(cell, CreatedFastCell).inspectSync(console.debug).throw(t)

      await this.events.tryEmit("CREATED_FAST", cell2).then(r => r.throw(t))

      return Ok.void()
    })
  }

  async #onDestroyCell(cell: Cell<Opaque>): Promise<Result<void, Panic | BinaryReadError | InvalidCommandError | InvalidCircuitError | EventError>> {
    return await Result.unthrow(async t => {
      const cell2 = Cell.Circuitful.tryInto(cell, DestroyCell).inspectSync(console.debug).throw(t)

      this.circuits.inner.delete(cell2.circuit.id)

      await this.events.tryEmit("DESTROY", cell2).then(r => r.throw(t))

      return Ok.void()
    })
  }

  async #onRelayCell(parent: Cell<Opaque>): Promise<Result<void, Panic | BinaryError | InvalidCommandError | InvalidCircuitError | InvalidStreamError | EventError>> {
    return await Result.unthrow(async t => {
      const raw = RelayCell.Raw.tryUncell(parent).throw(t)
      const cell = raw.tryUnpack().throw(t)

      if (cell.rcommand === RelayExtended2Cell.rcommand)
        return await this.#onRelayExtended2Cell(cell)
      if (cell.rcommand === RelayConnectedCell.rcommand)
        return await this.#onRelayConnectedCell(cell)
      if (cell.rcommand === RelayDataCell.rcommand)
        return await this.#onRelayDataCell(cell)
      if (cell.rcommand === RelayEndCell.rcommand)
        return await this.#onRelayEndCell(cell)
      if (cell.rcommand === RelayDropCell.rcommand)
        return await this.#onRelayDropCell(cell)
      if (cell.rcommand === RelayTruncatedCell.rcommand)
        return await this.#onRelayTruncatedCell(cell)

      console.debug(`Unknown relay cell ${cell.rcommand}`)
      return Ok.void()
    })
  }

  async #onRelayExtended2Cell(cell: RelayCell<Opaque>): Promise<Result<void, Panic | BinaryError | InvalidCommandError | InvalidStreamError | EventError>> {
    return await Result.unthrow(async t => {
      const cell2 = RelayCell.Streamless.tryInto(cell, RelayExtended2Cell).inspectSync(console.debug).throw(t)

      await this.events.tryEmit("RELAY_EXTENDED2", cell2).then(r => r.throw(t))

      return Ok.void()
    })
  }

  async #onRelayConnectedCell(cell: RelayCell<Opaque>): Promise<Result<void, Panic | BinaryError | InvalidCommandError | InvalidStreamError | EventError>> {
    return await Result.unthrow(async t => {
      const cell2 = RelayCell.Streamful.tryInto(cell, RelayConnectedCell).inspectSync(console.debug).throw(t)

      await this.events.tryEmit("RELAY_CONNECTED", cell2).then(r => r.throw(t))

      return Ok.void()
    })
  }

  async #onRelayDataCell(cell: RelayCell<Opaque>): Promise<Result<void, Panic | BinaryError | InvalidCommandError | InvalidStreamError | EventError>> {
    return await Result.unthrow(async t => {
      const cell2 = RelayCell.Streamful.tryInto(cell, RelayDataCell).inspectSync(console.debug).throw(t)

      await this.events.tryEmit("RELAY_DATA", cell2).then(r => r.throw(t))

      return Ok.void()
    })
  }

  async #onRelayEndCell(cell: RelayCell<Opaque>): Promise<Result<void, Panic | BinaryError | InvalidCommandError | InvalidStreamError | EventError>> {
    return await Result.unthrow(async t => {
      const cell2 = RelayCell.Streamful.tryInto(cell, RelayEndCell).inspectSync(console.debug).throw(t)

      await this.events.tryEmit("RELAY_END", cell2).then(r => r.throw(t))

      return Ok.void()
    })
  }

  async #onRelayDropCell(cell: RelayCell<Opaque>): Promise<Result<void, Panic | BinaryError | InvalidCommandError | InvalidStreamError>> {
    return RelayCell.Streamful.tryInto(cell, RelayDropCell).inspectSync(console.debug).clear()
  }

  async #onRelayTruncatedCell(cell: RelayCell<Opaque>): Promise<Result<void, Panic | BinaryError | InvalidCommandError | InvalidStreamError | EventError>> {
    return await Result.unthrow(async t => {
      const cell2 = RelayCell.Streamless.tryInto(cell, RelayTruncatedCell).inspectSync(console.debug).throw(t)

      cell2.circuit.targets.pop()

      await this.events.tryEmit("RELAY_TRUNCATED", cell2).then(r => r.throw(t))

      return Ok.void()
    })
  }

  async #tryCreateCircuit(): Promise<Result<SecretCircuit, BinaryReadError>> {
    return await this.circuits.lock(this.#tryCreateCircuitLocked.bind(this))
  }

  async #tryCreateCircuitLocked(circuits: Map<number, SecretCircuit>): Promise<Result<SecretCircuit, BinaryReadError>> {
    return Result.unthrowSync(t => {
      while (true) {
        const rawCircuitId = new Cursor(Bytes.random(4)).tryGetUint32().throw(t)

        if (rawCircuitId === 0)
          continue

        const circuitId = new Bitset(rawCircuitId, 32)
          .enableBE(0)
          .unsign()
          .value

        if (circuits.has(circuitId))
          continue

        const circuit = new SecretCircuit(circuitId, this)
        circuits.set(circuitId, circuit)

        return new Ok(circuit)
      }
    })
  }

  async #tryWaitCreatedFast(circuit: SecretCircuit, signal: AbortSignal): Promise<Result<Cell.Circuitful<CreatedFastCell>, AbortError | ErrorError | CloseError>> {
    return await Plume.tryWaitStream(this.events, "CREATED_FAST", e => {
      if (e.circuit !== circuit)
        return new Ok(new None())
      return new Ok(new Some(new Ok(e)))
    }, signal)
  }

  async tryCreateAndExtendLoop(signal?: AbortSignal) {
    return await Result.unthrow(async t => {

      while (!this.closed && !signal?.aborted) {
        const circuit = await this.tryCreateLoop(signal).then(r => r.throw(t))

        const extend1 = await circuit.tryExtendLoop(false, signal)

        if (extend1.isOk()) {
          const extend2 = await circuit.tryExtendLoop(true, signal)

          if (extend2.isOk())
            return new Ok(circuit)

          if (circuit.closed && !this.closed && !signal?.aborted) {
            console.warn("Create and extend failed")
            continue
          }

          return extend2
        }

        if (circuit.closed && !this.closed && !signal?.aborted) {
          console.warn("Create and extend failed")
          continue
        }

        return extend1
      }

      if (this.closed?.reason !== undefined)
        return new Err(ErrorError.from(this.closed.reason))
      if (this.closed !== undefined)
        return new Err(CloseError.from(this.closed.reason))
      if (signal?.aborted)
        return new Err(AbortError.from(signal.reason))
      throw new Panic()
    })
  }

  async tryCreateLoop(signal?: AbortSignal): Promise<Result<Circuit, BinaryError | AbortError | ErrorError | CloseError>> {
    const signal2 = AbortSignals.timeout(30_000, signal)

    while (!this.closed && !signal2.aborted) {
      const result = await this.tryCreate(signal2)

      if (result.isOk())
        return result

      if (this.closed)
        return result
      if (signal2.aborted)
        return result

      if (result.inner.name === AbortError.name) {
        console.warn("Create aborted", result.get())
        continue
      }

      if (result.inner.name === "TODO") {
        console.warn("Create failed", result.get())
        continue
      }

      return result
    }

    if (this.closed?.reason !== undefined)
      return new Err(ErrorError.from(this.closed.reason))
    if (this.closed !== undefined)
      return new Err(CloseError.from(this.closed.reason))
    if (signal2.aborted)
      return new Err(AbortError.from(signal2.reason))
    throw new Panic()
  }

  async tryCreate(signal?: AbortSignal): Promise<Result<Circuit, BinaryError | AbortError | ErrorError | CloseError>> {
    return await Result.unthrow(async t => {
      if (this.#state.type !== "handshaked")
        throw new Error(`Can't create a circuit yet`)

      const signal2 = AbortSignals.timeout(5_000, signal)

      const circuit = await this.#tryCreateCircuit().then(r => r.throw(t))
      const material = Bytes.random(20)

      const create_fast = new CreateFastCell(material)
      this.writer.enqueue(Cell.Circuitful.from(circuit, create_fast))

      const created_fast = await this.#tryWaitCreatedFast(circuit, signal2).then(r => r.throw(t))

      const k0 = Bytes.concat([material, created_fast.fragment.material])
      const result = await KDFTorResult.tryCompute(k0).then(r => r.throw(t))

      if (!Bytes.equals(result.keyHash, created_fast.fragment.derivative))
        throw new Error(`Invalid KDF-TOR key hash`)

      const forwardDigest = new this.params.sha1.Hasher()
      const backwardDigest = new this.params.sha1.Hasher()

      forwardDigest.update(result.forwardDigest)
      backwardDigest.update(result.backwardDigest)

      const forwardKey = new Aes128Ctr128BEKey(result.forwardKey, Bytes.alloc(16))
      const backwardKey = new Aes128Ctr128BEKey(result.backwardKey, Bytes.alloc(16))

      const target = new Target(this.#state.guard.idh, circuit, forwardDigest, backwardDigest, forwardKey, backwardKey)

      circuit.targets.push(target)

      return new Ok(new Circuit(circuit))
    })
  }
}