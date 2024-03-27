import { Opaque, Readable, Writable } from "@hazae41/binary";
import { Bitset } from "@hazae41/bitset";
import { Bytes, Uint8Array } from "@hazae41/bytes";
import { Ciphers, TlsClientDuplex } from "@hazae41/cadenas";
import { HalfDuplex } from "@hazae41/cascade";
import { Cursor } from "@hazae41/cursor";
import { Future } from "@hazae41/future";
import { Mutex } from "@hazae41/mutex";
import { None } from "@hazae41/option";
import { Paimon } from "@hazae41/paimon";
import { CloseEvents, ErrorEvents, Plume, SuperEventTarget } from "@hazae41/plume";
import { Panic, Result } from "@hazae41/result";
import { Sha1 } from "@hazae41/sha1";
import { Signals } from "@hazae41/signals";
import { X509 } from "@hazae41/x509";
import { Aes128Ctr128BEKey, Zepar } from "@hazae41/zepar";
import { Resizer } from "libs/resizer/resizer.js";
import { Console } from "mods/console/index.js";
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
import { Circuit, SecretCircuit } from "mods/tor/circuit.js";
import { Target } from "mods/tor/target.js";
import { InvalidKdfKeyHashError, KDFTorResult } from "./algorithms/kdftor.js";
import { ExpectedStreamError, InvalidCellError, InvalidRelayCellDigestError, InvalidRelaySendmeCellDigestError } from "./binary/cells/errors.js";
import { OldCell } from "./binary/cells/old.js";
import { RelaySendmeCircuitCell, RelaySendmeDigest, RelaySendmeStreamCell } from "./binary/cells/relayed/relay_sendme/cell.js";
import { Certs } from "./certs/certs.js";
import { InvalidTorStateError, InvalidTorVersionError } from "./errors.js";
import { TorHandshakingState, TorNoneState, TorState, TorVersionedState } from "./state.js";

export interface Guard {
  readonly identity: Uint8Array<20>
  readonly certs: Certs
}

export type TorClientDuplexEvents =
  & CloseEvents
  & ErrorEvents

export class TorClientDuplex {

  readonly #secret: SecretTorClientDuplex

  readonly events = new SuperEventTarget<TorClientDuplexEvents>()

  constructor() {
    this.#secret = new SecretTorClientDuplex()

    this.#secret.events.on("close", () => this.events.emit("close"))
    this.#secret.events.on("error", e => this.events.emit("error", e))
  }

  [Symbol.dispose]() {
    this.close().catch(console.error)
  }

  async [Symbol.asyncDispose]() {
    await this.close()
  }

  get inner() {
    return this.#secret.inner
  }

  get outer() {
    return this.#secret.outer
  }

  get closing() {
    return this.#secret.closing
  }

  get closed() {
    return this.#secret.closed
  }

  async error(reason?: unknown) {
    await this.#secret.error(reason)
  }

  async close() {
    await this.#secret.close()
  }

  async waitOrThrow() {
    return await this.#secret.waitOrThrow()
  }

  async tryWait() {
    return await this.#secret.tryWait()
  }

  async createOrThrow(signal?: AbortSignal) {
    return await this.#secret.createOrThrow(signal)
  }

  async tryCreate(signal?: AbortSignal) {
    return await this.#secret.tryCreate(signal)
  }

}

export type SecretTorEvents =
  & CloseEvents
  & ErrorEvents
  & { handshaked: () => void }
  & {
    "CREATED_FAST": (cell: Cell.Circuitful<CreatedFastCell>) => void
    "DESTROY": (cell: Cell.Circuitful<DestroyCell>) => void
    "RELAY_CONNECTED": (cell: RelayCell.Streamful<Opaque>) => void
    "RELAY_DATA": (cell: RelayCell.Streamful<RelayDataCell<Opaque>>) => void
    "RELAY_EXTENDED2": (cell: RelayCell.Streamless<RelayExtended2Cell<Opaque>>) => void
    "RELAY_TRUNCATED": (cell: RelayCell.Streamless<RelayTruncatedCell>) => void
    "RELAY_END": (cell: RelayCell.Streamful<RelayEndCell>) => void
  }

export class SecretTorClientDuplex {

  readonly ciphers = [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384]

  readonly tls: TlsClientDuplex

  readonly duplex: HalfDuplex<Opaque, Writable>

  readonly events = new SuperEventTarget<SecretTorEvents>()

  readonly circuits = new Mutex(new Map<number, SecretCircuit>())

  readonly #buffer = new Resizer()

  readonly #resolveOnStart = new Future<void>()
  readonly #resolveOnTlsCertificates = new Future<X509.Certificate[]>()

  #state: TorState = { type: "none" }

  constructor() {
    this.tls = new TlsClientDuplex({
      /**
       * Do not validate root certificates
       */
      authorized: true,
      ciphers: [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384],
      certificates: c => this.#resolveOnTlsCertificates.resolve(c)
    })

    this.duplex = new HalfDuplex<Opaque, Writable>({
      output: {
        start: () => this.#onOutputStart(),
      },
      input: {
        write: c => this.#onInputWrite(c),
      },
      close: async () => void await this.events.emit("close"),
      error: async e => void await this.events.emit("error", e)
    })

    this.tls.outer.readable.pipeTo(this.duplex.inner.writable).catch(() => { })
    this.duplex.inner.readable.pipeTo(this.tls.outer.writable).catch(() => { })

    this.#resolveOnStart.resolve()
  }

  [Symbol.dispose]() {
    this.close()
  }

  async #init() {
    await Paimon.initBundledOnce()
    await Zepar.initBundledOnce()
  }

  get state() {
    return this.#state
  }

  /**
   * TLS inner pair
   */
  get inner() {
    return this.tls.inner
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

  get closing() {
    return this.duplex.closing
  }

  get closed() {
    return this.duplex.closed
  }

  error(reason?: unknown) {
    this.duplex.error(reason)
  }

  close() {
    this.duplex.close()
  }

  async #onOutputStart() {
    await this.#resolveOnStart.promise

    await this.#init()

    this.output.enqueue(OldCell.Circuitless.from(undefined, new VersionsCell([5])))

    await Plume.waitOrCloseOrError(this.events, "handshaked", (future: Future<void>) => {
      future.resolve()
      return new None()
    })
  }

  async #onInputWrite(chunk: Opaque) {
    // Console.debug(this.#class.name, "<-", chunk)

    if (this.#buffer.inner.offset)
      await this.#onReadBuffered(chunk.bytes)
    else
      await this.#onReadDirect(chunk.bytes)
  }

  /**
   * Read from buffer
   * @param chunk 
   * @returns 
   */
  async #onReadBuffered(chunk: Uint8Array) {
    this.#buffer.writeOrThrow(chunk)
    const full = new Uint8Array(this.#buffer.inner.before)

    this.#buffer.inner.offset = 0
    await this.#onReadDirect(full)
  }

  /**
   * Zero-copy reading
   * @param chunk 
   * @returns 
   */
  async #onReadDirect(chunk: Uint8Array) {
    const cursor = new Cursor(chunk)

    while (cursor.remaining) {
      let raw:
        | OldCell.Raw<Opaque>
        | Cell.Raw<Opaque>

      try {
        raw = this.#state.type === "none"
          ? Readable.readOrRollbackAndThrow(OldCell.Raw, cursor)
          : Readable.readOrRollbackAndThrow(Cell.Raw, cursor)
      } catch (e: unknown) {
        this.#buffer.writeOrThrow(cursor.after)
        break
      }

      const cell = raw.unpackOrNull(this)

      if (cell == null)
        continue

      await this.#onCell(cell, this.#state)
    }
  }

  async #onCell(cell: Cell<Opaque> | OldCell<Opaque>, state: TorState) {
    if (cell.command === PaddingCell.command) {
      Console.debug(cell)
      return
    }

    if (cell.command === VariablePaddingCell.command) {
      Console.debug(cell)
      return
    }

    if (state.type === "none")
      return await this.#onNoneStateCell(cell, state)

    if (cell instanceof OldCell.Circuitful)
      throw new InvalidCellError()
    if (cell instanceof OldCell.Circuitless)
      throw new InvalidCellError()

    if (state.type === "versioned")
      return await this.#onVersionedStateCell(cell, state)
    if (state.type === "handshaking")
      return await this.#onHandshakingStateCell(cell, state)
    if (state.type === "handshaked")
      return await this.#onHandshakedStateCell(cell)

    throw new Panic(`Unknown state`)
  }

  async #onNoneStateCell(cell: Cell<Opaque> | OldCell<Opaque>, state: TorNoneState) {
    if (cell instanceof Cell.Circuitful)
      throw new InvalidCellError()
    if (cell instanceof Cell.Circuitless)
      throw new InvalidCellError()

    if (cell.command === VersionsCell.command)
      return await this.#onVersionsCell(cell, state)

    console.warn(`Unknown pre-version cell ${cell.command}`)
  }

  async #onVersionedStateCell(cell: Cell<Opaque>, state: TorVersionedState) {
    if (cell.command === CertsCell.command)
      return await this.#onCertsCell(cell, state)

    console.warn(`Unknown versioned-state cell ${cell.command}`)
  }

  async #onHandshakingStateCell(cell: Cell<Opaque>, state: TorHandshakingState) {
    if (cell.command === AuthChallengeCell.command)
      return await this.#onAuthChallengeCell(cell, state)
    if (cell.command === NetinfoCell.command)
      return await this.#onNetinfoCell(cell, state)

    console.warn(`Unknown handshaking-state cell ${cell.command}`)
  }

  async #onHandshakedStateCell(cell: Cell<Opaque>) {
    if (cell.command === CreatedFastCell.command)
      return await this.#onCreatedFastCell(cell)
    if (cell.command === DestroyCell.command)
      return await this.#onDestroyCell(cell)
    if (cell.command === RelayCell.command)
      return await this.#onRelayCell(cell)

    console.warn(`Unknown handshaked-state cell ${cell.command}`)
  }

  async #onVersionsCell(cell: OldCell<Opaque>, state: TorNoneState) {
    const cell2 = OldCell.Circuitless.intoOrThrow(cell, VersionsCell)

    Console.debug(cell2)

    if (!cell2.fragment.versions.includes(5))
      throw new InvalidTorVersionError()

    this.#state = { ...state, type: "versioned", version: 5 }
  }

  async #onCertsCell(cell: Cell<Opaque>, state: TorVersionedState) {
    const cell2 = Cell.Circuitless.intoOrThrow(cell, CertsCell)

    Console.debug(cell2)

    const tlsCerts = await this.#resolveOnTlsCertificates.promise
    const torCerts = await Certs.verifyOrThrow(cell2.fragment.certs, tlsCerts)

    const identity = await torCerts.rsa_self.sha1OrThrow()
    const guard: Guard = { certs: torCerts, identity }

    this.#state = { ...state, type: "handshaking", guard }
  }

  async #onAuthChallengeCell(cell: Cell<Opaque>, state: TorHandshakingState) {
    Console.debug(Cell.Circuitless.intoOrThrow(cell, AuthChallengeCell))
  }

  async #onNetinfoCell(cell: Cell<Opaque>, state: TorHandshakingState) {
    const cell2 = Cell.Circuitless.intoOrThrow(cell, NetinfoCell)

    Console.debug(cell2)

    const address = new TypedAddress(4, new Uint8Array([127, 0, 0, 1]))
    const netinfo = new NetinfoCell(0, address, [])
    this.output.enqueue(Cell.Circuitless.from(undefined, netinfo))

    const pversion = PaddingNegociateCell.versions.ZERO
    const pcommand = PaddingNegociateCell.commands.STOP
    const padding_negociate = new PaddingNegociateCell(pversion, pcommand, 0, 0)
    this.output.enqueue(Cell.Circuitless.from(undefined, padding_negociate))

    this.#state = { ...state, type: "handshaked" }

    await this.events.emit("handshaked")
  }

  async #onCreatedFastCell(cell: Cell<Opaque>) {
    const cell2 = Cell.Circuitful.intoOrThrow(cell, CreatedFastCell)

    Console.debug(cell2)

    await this.events.emit("CREATED_FAST", cell2)
  }

  async #onDestroyCell(cell: Cell<Opaque>) {
    const cell2 = Cell.Circuitful.intoOrThrow(cell, DestroyCell)

    Console.debug(cell2)

    this.circuits.inner.delete(cell2.circuit.id)

    await this.events.emit("DESTROY", cell2)
  }

  async #onRelayCell(parent: Cell<Opaque>) {
    const raw = RelayCell.Raw.uncellOrThrow(parent)
    const cell = raw.unpackOrNull()

    if (cell == null)
      return

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
    if (cell.rcommand === RelaySendmeCircuitCell.rcommand && cell.stream == null)
      return await this.#onRelaySendmeCircuitCell(cell)
    if (cell.rcommand === RelaySendmeStreamCell.rcommand && cell.stream != null)
      return await this.#onRelaySendmeStreamCell(cell)

    console.warn(`Unknown relay cell ${cell.rcommand}`)
  }

  async #onRelayExtended2Cell(cell: RelayCell<Opaque>) {
    const cell2 = RelayCell.Streamless.intoOrThrow(cell, RelayExtended2Cell)

    Console.debug(cell2)

    await this.events.emit("RELAY_EXTENDED2", cell2)
  }

  async #onRelayConnectedCell(cell: RelayCell<Opaque>) {
    if (cell.stream == null)
      throw new ExpectedStreamError()

    await this.events.emit("RELAY_CONNECTED", cell)
  }

  async #onRelayDataCell(cell: RelayCell<Opaque>) {
    const cell2 = RelayCell.Streamful.intoOrThrow(cell, RelayDataCell)

    Console.debug(cell2)

    const exit = cell2.circuit.targets[cell2.circuit.targets.length - 1]

    exit.delivery--

    if (exit.delivery === 900) {
      exit.delivery = 1000

      if (cell2.digest == null)
        throw new InvalidRelayCellDigestError()

      const digest = new RelaySendmeDigest(cell2.digest)
      const sendme = new RelaySendmeCircuitCell(1, digest)

      const sendme_cell = RelayCell.Streamless.from(cell2.circuit, undefined, sendme)
      this.output.enqueue(sendme_cell.cellOrThrow())
    }

    await this.events.emit("RELAY_DATA", cell2)
  }

  async #onRelayEndCell(cell: RelayCell<Opaque>) {
    const cell2 = RelayCell.Streamful.intoOrThrow(cell, RelayEndCell)

    Console.debug(cell2)

    await this.events.emit("RELAY_END", cell2)
  }

  async #onRelayDropCell(cell: RelayCell<Opaque>) {
    Console.debug(RelayCell.Streamful.intoOrThrow(cell, RelayDropCell))
  }

  async #onRelayTruncatedCell(cell: RelayCell<Opaque>) {
    const cell2 = RelayCell.Streamless.intoOrThrow(cell, RelayTruncatedCell)

    Console.debug(cell2)

    cell2.circuit.targets.pop()

    await this.events.emit("RELAY_TRUNCATED", cell2)
  }

  async #onRelaySendmeCircuitCell(cell: RelayCell<Opaque>) {
    const cell2 = RelayCell.Streamless.intoOrThrow(cell, RelaySendmeCircuitCell)

    Console.debug(cell2)

    if (cell2.fragment.version === 0) {
      const exit = cell2.circuit.targets[cell2.circuit.targets.length - 1]

      exit.package += 100

      return
    }

    if (cell2.fragment.version === 1) {
      const digest = cell2.fragment.fragment.readIntoOrThrow(RelaySendmeDigest)

      Console.debug(digest)

      const exit = cell2.circuit.targets[cell2.circuit.targets.length - 1]
      const digest2 = exit.digests.shift()

      if (digest2 == null)
        throw new InvalidRelaySendmeCellDigestError()
      if (!Bytes.equals(digest.digest, digest2))
        throw new InvalidRelaySendmeCellDigestError()

      exit.package += 100

      return
    }

    console.warn(`Unknown RELAY_SENDME circuit cell version ${cell2.fragment.version}`)
  }

  async #onRelaySendmeStreamCell(cell: RelayCell<Opaque>) {
    const cell2 = RelayCell.Streamful.intoOrThrow(cell, RelaySendmeStreamCell)

    Console.debug(cell2)

    cell2.stream.package += 50
  }


  async waitOrThrow() {
    if (this.state.type === "handshaked")
      return

    await Plume.waitOrCloseOrError(this.events, "handshaked", (future: Future<void>) => {
      future.resolve()
      return new None()
    })
  }

  async tryWait(): Promise<Result<void, Error>> {
    return await Result.runAndWrap(async () => {
      await this.waitOrThrow()
    }).then(r => r.mapErrSync(cause => new Error(`Could not wait`, { cause })))
  }

  async #createCircuitOrThrow() {
    return await this.circuits.lock(async (circuits) => {
      while (true) {
        const rawCircuitId = new Cursor(Bytes.random(4)).getUint32OrThrow()

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

        return circuit
      }
    })
  }

  async #waitCreatedFast(circuit: SecretCircuit, signal = Signals.never()): Promise<Cell.Circuitful<CreatedFastCell>> {
    return await Plume.waitOrCloseOrErrorOrSignal(this.events, "CREATED_FAST", async (future: Future<Cell.Circuitful<CreatedFastCell>>, e) => {
      if (e.circuit !== circuit)
        return new None()
      future.resolve(e)
      return new None()
    }, signal)
  }

  async createOrThrow(signal = Signals.never()) {
    if (this.#state.type !== "handshaked")
      throw new InvalidTorStateError()

    const circuit = await this.#createCircuitOrThrow()
    const material = Bytes.random(20)

    const create_fast = new CreateFastCell(material)
    this.output.enqueue(Cell.Circuitful.from(circuit, create_fast))

    const created_fast = await this.#waitCreatedFast(circuit, signal)

    const k0 = Bytes.concat([material, created_fast.fragment.material])
    const result = await KDFTorResult.computeOrThrow(k0)

    if (!Bytes.equals(result.keyHash, created_fast.fragment.derivative))
      throw new InvalidKdfKeyHashError()

    const forwardDigest = Sha1.get().Hasher.createOrThrow()
    const backwardDigest = Sha1.get().Hasher.createOrThrow()

    forwardDigest.updateOrThrow(result.forwardDigest)
    backwardDigest.updateOrThrow(result.backwardDigest)

    using forwardKeyMemory = new Zepar.Memory(result.forwardKey)
    using forwardIvMemory = new Zepar.Memory(new Uint8Array(16))

    using backwardKeyMemory = new Zepar.Memory(result.backwardKey)
    using backwardIvMemory = new Zepar.Memory(new Uint8Array(16))

    const forwardKey = new Aes128Ctr128BEKey(forwardKeyMemory, forwardIvMemory)
    const backwardKey = new Aes128Ctr128BEKey(backwardKeyMemory, backwardIvMemory)

    const target = new Target(this.#state.guard.identity, circuit, forwardDigest, backwardDigest, forwardKey, backwardKey)

    circuit.targets.push(target)

    return new Circuit(circuit)
  }

  async tryCreate(signal: AbortSignal = Signals.never()): Promise<Result<Circuit, Error>> {
    return await Result.runAndWrap(async () => {
      return await this.createOrThrow(signal)
    }).then(r => r.mapErrSync(cause => new Error(`Could not create`, { cause })))
  }

}