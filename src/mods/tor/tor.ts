import { Arrays } from "@hazae41/arrays";
import { ASN1Error, DERReadError } from "@hazae41/asn1";
import { BinaryError, BinaryReadError, Opaque, Readable, Writable } from "@hazae41/binary";
import { Bitset } from "@hazae41/bitset";
import { Bytes, BytesCastError } from "@hazae41/bytes";
import { TlsClientDuplex } from "@hazae41/cadenas";
import { ControllerError, SuperTransformStream } from "@hazae41/cascade";
import { Cursor } from "@hazae41/cursor";
import type { Ed25519 } from "@hazae41/ed25519";
import { Future } from "@hazae41/future";
import { Mutex } from "@hazae41/mutex";
import { None } from "@hazae41/option";
import { Paimon } from "@hazae41/paimon";
import { TooManyRetriesError } from "@hazae41/piscine";
import { AbortedError, CloseEvents, ClosedError, ErrorEvents, ErroredError, EventError, Plume, SuperEventTarget } from "@hazae41/plume";
import { Err, Ok, Panic, Result } from "@hazae41/result";
import type { Sha1 } from "@hazae41/sha1";
import type { X25519 } from "@hazae41/x25519";
import { Aes128Ctr128BEKey, Zepar } from "@hazae41/zepar";
import { CryptoError } from "libs/crypto/crypto.js";
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
import { Circuit, EmptyFallbacksError, SecretCircuit } from "mods/tor/circuit.js";
import { Authority } from "mods/tor/consensus/authorities.js";
import { Target } from "mods/tor/target.js";
import { InvalidKdfKeyHashError, KDFTorResult } from "./algorithms/kdftor.js";
import { InvalidNtorAuthError } from "./algorithms/ntor/ntor.js";
import { CellError, ExpectedCircuitError, InvalidCellError, InvalidRelayCellDigestError, InvalidRelaySendmeCellDigestError, RelayCellError } from "./binary/cells/errors.js";
import { OldCell } from "./binary/cells/old.js";
import { RelaySendmeCircuitCell, RelaySendmeDigest, RelaySendmeStreamCell } from "./binary/cells/relayed/relay_sendme/cell.js";
import { CertError, Certs } from "./certs/certs.js";
import { InvalidTorStateError, InvalidTorVersionError } from "./errors.js";
import { TorHandshakingState, TorNoneState, TorState, TorVersionedState } from "./state.js";

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

  get events() {
    return this.#secret.events
  }

  get closed() {
    return Boolean(this.#secret.closed)
  }

  close(reason?: unknown) {
    this.#secret.close(reason)
  }

  async tryWait() {
    if (this.#secret.state.type === "handshaked")
      return Ok.void()
    return await Plume.tryWaitOrCloseOrError(this.#secret.events, "handshaked", (future: Future<Ok<void>>) => {
      future.resolve(Ok.void())
      return new None()
    })
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

export type SecretTorEvents = CloseEvents & ErrorEvents & {
  "handshaked": () => void

  "CREATED_FAST": (cell: Cell.Circuitful<CreatedFastCell>) => Result<void, Error>
  "DESTROY": (cell: Cell.Circuitful<DestroyCell>) => Result<void, Error>
  "RELAY_CONNECTED": (cell: RelayCell.Streamful<RelayConnectedCell>) => Result<void, Error>
  "RELAY_DATA": (cell: RelayCell.Streamful<RelayDataCell<Opaque>>) => Result<void, Error>
  "RELAY_EXTENDED2": (cell: RelayCell.Streamless<RelayExtended2Cell<Opaque>>) => Result<void, Error>
  "RELAY_TRUNCATED": (cell: RelayCell.Streamless<RelayTruncatedCell>) => Result<void, Error>
  "RELAY_END": (cell: RelayCell.Streamful<RelayEndCell>) => Result<void, Error>
}

export class SecretTorClientDuplex {
  readonly #class = SecretTorClientDuplex

  readonly events = new SuperEventTarget<SecretTorEvents>()

  readonly reader: SuperTransformStream<Opaque, Opaque>
  readonly writer: SuperTransformStream<Writable, Writable>

  readonly authorities = new Array<Authority>()
  readonly circuits = new Mutex(new Map<number, SecretCircuit>())

  readonly #controller: AbortController

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
    this.#controller = new AbortController()

    const signal = AbortSignals.merge(this.#controller.signal, params.signal)

    // this.authorities = parseAuthorities()

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

  get state() {
    return this.#state
  }

  get closed() {
    return this.reader.closed
  }

  close(reason?: unknown) {
    this.#controller.abort(reason)
  }

  async #onReadClose() {
    console.debug(`${this.#class.name}.onReadClose`)

    this.reader.closed = {}

    await this.events.emit("close", [undefined])

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

    await this.events.emit("error", [reason])

    return Result.rethrow(reason)
  }

  async #onWriteError(reason?: unknown) {
    console.debug(`${this.#class.name}.onWriteError`, { reason })

    this.writer.closed = { reason }
    this.reader.error(reason)

    return Result.rethrow(reason)
  }

  async #onWriteStart(): Promise<Result<void, ErroredError | ClosedError>> {
    await this.#init()

    const version = new VersionsCell([5])
    this.writer.enqueue(OldCell.Circuitless.from(undefined, version))

    return await Plume.tryWaitOrCloseOrError(this.events, "handshaked", (future: Future<Ok<void>>) => {
      future.resolve(Ok.void())
      return new None()
    })
  }

  async #onRead(chunk: Opaque): Promise<Result<void, CryptoError | InvalidTorVersionError | BinaryError | CellError | RelayCellError | DERReadError | ASN1Error | CertError | EventError | ControllerError>> {
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
  async #onReadBuffered(chunk: Uint8Array): Promise<Result<void, CryptoError | InvalidTorVersionError | BinaryError | CellError | RelayCellError | DERReadError | ASN1Error | CertError | EventError | ControllerError>> {
    return await Result.unthrow(async t => {
      this.#buffer.tryWrite(chunk).throw(t)
      const full = new Uint8Array(this.#buffer.before)

      this.#buffer.offset = 0
      return await this.#onReadDirect(full)
    })
  }

  /**
   * Zero-copy reading
   * @param chunk 
   * @returns 
   */
  async #onReadDirect(chunk: Uint8Array): Promise<Result<void, CryptoError | InvalidTorVersionError | BinaryError | CellError | RelayCellError | DERReadError | ASN1Error | CertError | EventError | ControllerError>> {
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
        await this.#onCell(cell, this.#state).then(r => r.throw(t))
      }

      return Ok.void()
    })
  }

  async #onCell(cell: Cell<Opaque> | OldCell<Opaque>, state: TorState): Promise<Result<void, CryptoError | InvalidTorVersionError | BinaryError | CellError | RelayCellError | DERReadError | ASN1Error | CertError | EventError | ControllerError>> {
    if (cell.command === PaddingCell.command)
      return new Ok(console.debug(cell))
    if (cell.command === VariablePaddingCell.command)
      return new Ok(console.debug(cell))

    if (state.type === "none")
      return await this.#onNoneStateCell(cell, state)

    if (cell instanceof OldCell.Circuitful)
      return new Err(new InvalidCellError())
    if (cell instanceof OldCell.Circuitless)
      return new Err(new InvalidCellError())

    if (state.type === "versioned")
      return await this.#onVersionedStateCell(cell, state)
    if (state.type === "handshaking")
      return await this.#onHandshakingStateCell(cell, state)
    if (state.type === "handshaked")
      return await this.#onHandshakedStateCell(cell)

    throw new Panic()
  }

  async #onNoneStateCell(cell: Cell<Opaque> | OldCell<Opaque>, state: TorNoneState): Promise<Result<void, InvalidTorVersionError | BinaryReadError | CellError>> {
    if (cell instanceof Cell.Circuitful)
      return new Err(new InvalidCellError())
    if (cell instanceof Cell.Circuitless)
      return new Err(new InvalidCellError())

    if (cell.command === VersionsCell.command)
      return await this.#onVersionsCell(cell, state)

    console.warn(`Unknown pre-version cell ${cell.command}`)
    return Ok.void()
  }

  async #onVersionedStateCell(cell: Cell<Opaque>, state: TorVersionedState): Promise<Result<void, CryptoError | BinaryError | CellError | DERReadError | ASN1Error | CertError>> {
    if (cell.command === CertsCell.command)
      return await this.#onCertsCell(cell, state)

    console.warn(`Unknown versioned-state cell ${cell.command}`)
    return Ok.void()
  }

  async #onHandshakingStateCell(cell: Cell<Opaque>, state: TorHandshakingState): Promise<Result<void, BinaryReadError | CellError | EventError>> {
    if (cell.command === AuthChallengeCell.command)
      return await this.#onAuthChallengeCell(cell, state)
    if (cell.command === NetinfoCell.command)
      return await this.#onNetinfoCell(cell, state)

    console.warn(`Unknown handshaking-state cell ${cell.command}`)
    return Ok.void()
  }

  async #onHandshakedStateCell(cell: Cell<Opaque>): Promise<Result<void, BinaryError | CellError | RelayCellError | EventError | ControllerError>> {
    if (cell.command === CreatedFastCell.command)
      return await this.#onCreatedFastCell(cell)
    if (cell.command === DestroyCell.command)
      return await this.#onDestroyCell(cell)
    if (cell.command === RelayCell.command)
      return await this.#onRelayCell(cell)

    console.warn(`Unknown handshaked-state cell ${cell.command}`)
    return Ok.void()
  }

  async #onVersionsCell(cell: OldCell<Opaque>, state: TorNoneState): Promise<Result<void, InvalidTorVersionError | BinaryReadError | CellError>> {
    return await Result.unthrow(async t => {
      const cell2 = OldCell.Circuitless.tryInto(cell, VersionsCell).inspectSync(console.debug).throw(t)

      if (!cell2.fragment.versions.includes(5))
        return new Err(new InvalidTorVersionError())

      this.#state = { ...state, type: "versioned", version: 5 }

      return Ok.void()
    })
  }

  async #onCertsCell(cell: Cell<Opaque>, state: TorVersionedState): Promise<Result<void, CryptoError | BinaryError | CellError | DERReadError | ASN1Error | CertError>> {
    return await Result.unthrow(async t => {
      const cell2 = Cell.Circuitless.tryInto(cell, CertsCell).inspectSync(console.debug).throw(t)

      const certs = await Certs.tryVerify(cell2.fragment.certs, this.params.ed25519).then(r => r.throw(t))

      const idh = await certs.rsa_self.tryHash().then(r => r.throw(t))
      const guard = { certs, idh }

      this.#state = { ...state, type: "handshaking", guard }

      return Ok.void()
    })
  }

  async #onAuthChallengeCell(cell: Cell<Opaque>, state: TorHandshakingState): Promise<Result<void, BinaryReadError | CellError | ExpectedCircuitError>> {
    return Cell.Circuitless.tryInto(cell, AuthChallengeCell).inspectSync(console.debug).clear()
  }

  async #onNetinfoCell(cell: Cell<Opaque>, state: TorHandshakingState): Promise<Result<void, BinaryReadError | CellError | EventError>> {
    return await Result.unthrow(async t => {
      Cell.Circuitless.tryInto(cell, NetinfoCell).inspectSync(console.debug).throw(t)

      const address = new TypedAddress(4, new Uint8Array([127, 0, 0, 1]))
      const netinfo = new NetinfoCell(0, address, [])
      this.writer.enqueue(Cell.Circuitless.from(undefined, netinfo))

      const pversion = PaddingNegociateCell.versions.ZERO
      const pcommand = PaddingNegociateCell.commands.STOP
      const padding_negociate = new PaddingNegociateCell(pversion, pcommand, 0, 0)
      this.writer.enqueue(Cell.Circuitless.from(undefined, padding_negociate))

      this.#state = { ...state, type: "handshaked" }

      await this.events.emit("handshaked", [])

      return Ok.void()
    })
  }

  async #onCreatedFastCell(cell: Cell<Opaque>): Promise<Result<void, BinaryReadError | CellError | EventError>> {
    return await Result.unthrow(async t => {
      const cell2 = Cell.Circuitful.tryInto(cell, CreatedFastCell).inspectSync(console.debug).throw(t)

      const returned = await this.events.emit("CREATED_FAST", [cell2])

      if (returned.isSome() && returned.inner.isErr())
        return returned.inner.mapErrSync(EventError.new)

      return Ok.void()
    })
  }

  async #onDestroyCell(cell: Cell<Opaque>): Promise<Result<void, BinaryReadError | CellError | EventError>> {
    return await Result.unthrow(async t => {
      const cell2 = Cell.Circuitful.tryInto(cell, DestroyCell).inspectSync(console.debug).throw(t)

      this.circuits.inner.delete(cell2.circuit.id)

      const returned = await this.events.emit("DESTROY", [cell2])

      if (returned.isSome() && returned.inner.isErr())
        return returned.inner.mapErrSync(EventError.new)

      return Ok.void()
    })
  }

  async #onRelayCell(parent: Cell<Opaque>): Promise<Result<void, BinaryError | CellError | RelayCellError | EventError | ControllerError>> {
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
      if (cell.rcommand === RelaySendmeCircuitCell.rcommand && cell.stream === undefined)
        return await this.#onRelaySendmeCircuitCell(cell)
      if (cell.rcommand === RelaySendmeStreamCell.rcommand && cell.stream !== undefined)
        return await this.#onRelaySendmeStreamCell(cell)

      console.warn(`Unknown relay cell ${cell.rcommand}`)
      return Ok.void()
    })
  }

  async #onRelayExtended2Cell(cell: RelayCell<Opaque>): Promise<Result<void, BinaryError | RelayCellError | EventError>> {
    return await Result.unthrow(async t => {
      const cell2 = RelayCell.Streamless.tryInto(cell, RelayExtended2Cell).inspectSync(console.debug).throw(t)

      const returned = await this.events.emit("RELAY_EXTENDED2", [cell2])

      if (returned.isSome() && returned.inner.isErr())
        return returned.inner.mapErrSync(EventError.new)

      return Ok.void()
    })
  }

  async #onRelayConnectedCell(cell: RelayCell<Opaque>): Promise<Result<void, BinaryError | RelayCellError | EventError>> {
    return await Result.unthrow(async t => {
      const cell2 = RelayCell.Streamful.tryInto(cell, RelayConnectedCell).inspectSync(console.debug).throw(t)

      const returned = await this.events.emit("RELAY_CONNECTED", [cell2])

      if (returned.isSome() && returned.inner.isErr())
        return returned.inner.mapErrSync(EventError.new)

      return Ok.void()
    })
  }

  async #onRelayDataCell(cell: RelayCell<Opaque>): Promise<Result<void, BinaryError | RelayCellError | EventError | ControllerError>> {
    return await Result.unthrow(async t => {
      const cell2 = RelayCell.Streamful.tryInto(cell, RelayDataCell).inspectSync(console.debug).throw(t)

      const exit = Arrays.last(cell2.circuit.targets)!

      exit.delivery--

      if (exit.delivery === 900) {
        exit.delivery = 1000

        if (cell2.digest20 === undefined)
          throw Panic.from(new InvalidRelayCellDigestError())

        const digest = new RelaySendmeDigest(cell2.digest20)
        const sendme = new RelaySendmeCircuitCell(1, digest)

        const sendme_cell = RelayCell.Streamless.from(cell2.circuit, undefined, sendme)
        this.writer.tryEnqueue(sendme_cell.tryCell().throw(t)).throw(t)
      }

      const returned = await this.events.emit("RELAY_DATA", [cell2])

      if (returned.isSome() && returned.inner.isErr())
        return returned.inner.mapErrSync(EventError.new)

      return Ok.void()
    })
  }

  async #onRelayEndCell(cell: RelayCell<Opaque>): Promise<Result<void, BinaryError | RelayCellError | EventError>> {
    return await Result.unthrow(async t => {
      const cell2 = RelayCell.Streamful.tryInto(cell, RelayEndCell).inspectSync(console.debug).throw(t)

      const returned = await this.events.emit("RELAY_END", [cell2])

      if (returned.isSome() && returned.inner.isErr())
        return returned.inner.mapErrSync(EventError.new)

      return Ok.void()
    })
  }

  async #onRelayDropCell(cell: RelayCell<Opaque>): Promise<Result<void, BinaryError | RelayCellError>> {
    return RelayCell.Streamful.tryInto(cell, RelayDropCell).inspectSync(console.debug).clear()
  }

  async #onRelayTruncatedCell(cell: RelayCell<Opaque>): Promise<Result<void, BinaryError | RelayCellError | EventError>> {
    return await Result.unthrow(async t => {
      const cell2 = RelayCell.Streamless.tryInto(cell, RelayTruncatedCell).inspectSync(console.debug).throw(t)

      cell2.circuit.targets.pop()

      const returned = await this.events.emit("RELAY_TRUNCATED", [cell2])

      if (returned.isSome() && returned.inner.isErr())
        return returned.inner.mapErrSync(EventError.new)

      return Ok.void()
    })
  }

  async #onRelaySendmeCircuitCell(cell: RelayCell<Opaque>): Promise<Result<void, BinaryError | RelayCellError | EventError>> {
    return await Result.unthrow(async t => {
      const cell2 = RelayCell.Streamless.tryInto(cell, RelaySendmeCircuitCell).inspectSync(console.debug).throw(t)

      if (cell2.fragment.version === 0) {
        const exit = Arrays.last(cell2.circuit.targets)!

        exit.package += 100
        return Ok.void()
      }

      if (cell2.fragment.version === 1) {
        const digest = cell2.fragment.fragment.tryReadInto(RelaySendmeDigest).inspectSync(console.debug).throw(t)

        const exit = Arrays.last(cell2.circuit.targets)!
        const digest2 = exit.digests.shift()

        if (digest2 === undefined)
          return new Err(new InvalidRelaySendmeCellDigestError())
        if (!Bytes.equals(digest.digest, digest2))
          return new Err(new InvalidRelaySendmeCellDigestError())

        exit.package += 100
        return Ok.void()
      }

      console.warn(`Unknown RELAY_SENDME circuit cell version ${cell2.fragment.version}`)
      return Ok.void()
    })
  }

  async #onRelaySendmeStreamCell(cell: RelayCell<Opaque>): Promise<Result<void, BinaryError | RelayCellError | EventError>> {
    return await Result.unthrow(async t => {
      const cell2 = RelayCell.Streamful.tryInto(cell, RelaySendmeStreamCell).inspectSync(console.debug).throw(t)

      cell2.stream.package += 50
      return Ok.void()
    })
  }

  async #tryCreateCircuit(): Promise<Result<SecretCircuit, BinaryError>> {
    return await this.circuits.lock(this.#tryCreateCircuitLocked.bind(this))
  }

  async #tryCreateCircuitLocked(circuits: Map<number, SecretCircuit>): Promise<Result<SecretCircuit, BinaryError>> {
    return Result.unthrowSync(t => {
      while (true) {
        const rawCircuitId = new Cursor(Bytes.tryRandom(4).throw(t)).tryGetUint32().throw(t)

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

  async #tryWaitCreatedFast(circuit: SecretCircuit, signal?: AbortSignal): Promise<Result<Cell.Circuitful<CreatedFastCell>, AbortedError | ErroredError | ClosedError>> {
    return await Plume.tryWaitOrCloseOrErrorOrSignal(this.events, "CREATED_FAST", async (future: Future<Ok<Cell.Circuitful<CreatedFastCell>>>, e) => {
      if (e.circuit !== circuit)
        return new None()
      future.resolve(new Ok(e))
      return new None()
    }, AbortSignals.timeout(5_000, signal))
  }

  async tryCreateAndExtendLoop(signal?: AbortSignal): Promise<Result<Circuit, CryptoError | TooManyRetriesError | InvalidTorStateError | ErroredError | ClosedError | BinaryError | AbortedError | EmptyFallbacksError | InvalidNtorAuthError | InvalidKdfKeyHashError | BytesCastError | EventError>> {
    return await Result.unthrow(async t => {

      for (let i = 0; !this.closed && !signal?.aborted && i < 3; i++) {
        const circuit = await this.tryCreateLoop(signal).then(r => r.throw(t))

        const extend1 = await circuit.tryExtendLoop(false, signal).then(r => r.ignore())

        if (extend1.isOk()) {
          const extend2 = await circuit.tryExtendLoop(true, signal).then(r => r.ignore())

          if (extend2.isOk())
            return new Ok(circuit)

          if (circuit.destroyed && !this.closed && !signal?.aborted) {
            console.debug("Create and extend failed", { error: extend2.get() })
            await circuit.destroy()
            await new Promise(ok => setTimeout(ok, 1000 * (2 ** i)))
            continue
          }

          return extend2
        }

        if (circuit.destroyed && !this.closed && !signal?.aborted) {
          console.debug("Create and extend failed", { error: extend1.get() })
          await circuit.destroy()
          await new Promise(ok => setTimeout(ok, 1000 * (2 ** i)))
          continue
        }

        return extend1
      }

      if (this.closed?.reason !== undefined)
        return new Err(ErroredError.from(this.closed.reason))
      if (this.closed !== undefined)
        return new Err(ClosedError.from(this.closed.reason))
      if (signal?.aborted)
        return new Err(AbortedError.from(signal.reason))
      return new Err(new TooManyRetriesError())
    })
  }

  async tryCreateLoop(signal?: AbortSignal): Promise<Result<Circuit, TooManyRetriesError | InvalidKdfKeyHashError | InvalidTorStateError | BinaryError | AbortedError | ErroredError | ClosedError>> {
    return await Result.unthrow(async t => {
      for (let i = 0; !this.closed && !signal?.aborted && i < 3; i++) {
        const result = await this.tryCreate(signal)

        if (result.isOk())
          return result

        if (this.closed)
          return result
        if (signal?.aborted)
          return result

        if (result.inner.name === AbortedError.name) {
          console.debug("Create aborted", { error: result.get() })
          await new Promise(ok => setTimeout(ok, 1000 * (2 ** i)))
          continue
        }

        if (result.inner.name === InvalidKdfKeyHashError.name) {
          console.debug("Create failed", { error: result.get() })
          await new Promise(ok => setTimeout(ok, 1000 * (2 ** i)))
          continue
        }

        return result
      }

      if (this.closed?.reason !== undefined)
        return new Err(ErroredError.from(this.closed.reason))
      if (this.closed !== undefined)
        return new Err(ClosedError.from(this.closed.reason))
      if (signal?.aborted)
        return new Err(AbortedError.from(signal.reason))
      return new Err(new TooManyRetriesError())
    })
  }

  async tryCreate(signal?: AbortSignal): Promise<Result<Circuit, InvalidKdfKeyHashError | InvalidTorStateError | BinaryError | AbortedError | ErroredError | ClosedError>> {
    return await Result.unthrow(async t => {
      if (this.#state.type !== "handshaked")
        return new Err(new InvalidTorStateError())

      const circuit = await this.#tryCreateCircuit().then(r => r.throw(t))
      const material = Bytes.random(20)

      const create_fast = new CreateFastCell(material)
      this.writer.enqueue(Cell.Circuitful.from(circuit, create_fast))

      const created_fast = await this.#tryWaitCreatedFast(circuit, signal).then(r => r.throw(t))

      const k0 = Bytes.concat([material, created_fast.fragment.material])
      const result = await KDFTorResult.tryCompute(k0).then(r => r.throw(t))

      if (!Bytes.equals(result.keyHash, created_fast.fragment.derivative))
        return new Err(new InvalidKdfKeyHashError())

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