import { Opaque, Readable, Writable } from "@hazae41/binary";
import { Bitset } from "@hazae41/bitset";
import { Bytes } from "@hazae41/bytes";
import { TlsClientDuplex } from "@hazae41/cadenas";
import { SuperReadableStream, SuperWritableStream } from "@hazae41/cascade";
import { Cursor } from "@hazae41/cursor";
import { Future } from "@hazae41/future";
import { Mutex } from "@hazae41/mutex";
import { None, Some } from "@hazae41/option";
import { Paimon } from "@hazae41/paimon";
import { TooManyRetriesError } from "@hazae41/piscine";
import { AbortedError, CloseEvents, ClosedError, ErrorEvents, ErroredError, Plume, SuperEventTarget } from "@hazae41/plume";
import { Catched, Err, Ok, Panic, Result } from "@hazae41/result";
import { Sha1 } from "@hazae41/sha1";
import { Aes128Ctr128BEKey, Zepar } from "@hazae41/zepar";
import { AbortSignals } from "libs/signals/signals.js";
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
import { TorCiphers } from "mods/tor/ciphers.js";
import { Circuit, SecretCircuit } from "mods/tor/circuit.js";
import { Authority } from "mods/tor/consensus/authorities.js";
import { Target } from "mods/tor/target.js";
import { InvalidKdfKeyHashError, KDFTorResult } from "./algorithms/kdftor.js";
import { InvalidCellError, InvalidRelayCellDigestError, InvalidRelaySendmeCellDigestError } from "./binary/cells/errors.js";
import { OldCell } from "./binary/cells/old.js";
import { RelaySendmeCircuitCell, RelaySendmeDigest, RelaySendmeStreamCell } from "./binary/cells/relayed/relay_sendme/cell.js";
import { Certs } from "./certs/certs.js";
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
  readonly fallbacks: Fallback[]
  readonly signal?: AbortSignal
}

export class TorClientDuplex {

  readonly #secret: SecretTorClientDuplex

  constructor(
    readonly params: TorClientParams
  ) {
    this.#secret = new SecretTorClientDuplex(params)
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

  get inner() {
    return this.#secret.inner
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

  readonly input: SuperWritableStream<Opaque>
  readonly output: SuperReadableStream<Writable>

  readonly inner: ReadableWritablePair<Writable, Opaque>

  readonly authorities = new Array<Authority>()
  readonly circuits = new Mutex(new Map<number, SecretCircuit>())

  readonly #controller: AbortController

  readonly #buffer = new Cursor(new Uint8Array(65535))

  #state: TorState = { type: "none" }

  /**
   * Create a new Tor client
   * @param tcp Some TCP stream
   * @param params Tor params
   */
  constructor(
    readonly params: TorClientParams
  ) {
    this.#controller = new AbortController()

    // this.authorities = parseAuthorities()

    const ciphers = Object.values(TorCiphers)
    const tls = new TlsClientDuplex({ ciphers })

    tls.events.input.on("certificates", (certs) => {
      console.log(certs)
      return new Some(Ok.void())
    })

    this.inner = tls.inner

    this.input = new SuperWritableStream({
      write: this.#onInputWrite.bind(this)
    })

    this.output = new SuperReadableStream({
      start: this.#onOutputStart.bind(this)
    })

    const inputer = this.input.start()
    const outputer = this.output.start()

    tls.outer.readable
      .pipeTo(inputer)
      .then(() => this.#onReadClose())
      .catch(e => this.#onReadError(e))
      .catch(() => { })

    outputer
      .pipeTo(tls.outer.writable)
      .then(() => this.#onWriteClose())
      .catch(e => this.#onWriteError(e))
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
    return this.input.closed
  }

  close(reason?: unknown) {
    this.#controller.abort(reason)
  }

  async #onReadClose() {
    Console.debug(`${this.#class.name}.onReadClose`)

    this.input.closed = {}

    await this.events.emit("close", [undefined])

    return Ok.void()
  }

  async #onWriteClose() {
    Console.debug(`${this.#class.name}.onWriteClose`)

    this.output.closed = {}

    return Ok.void()
  }

  async #onReadError(reason?: unknown) {
    Console.debug(`${this.#class.name}.onReadError`, { reason })

    this.input.closed = { reason }
    this.output.error(reason)

    await this.events.emit("error", [reason])

    return Catched.throwOrErr(reason)
  }

  async #onWriteError(reason?: unknown) {
    Console.debug(`${this.#class.name}.onWriteError`, { reason })

    this.output.closed = { reason }
    this.input.error(reason)

    return Catched.throwOrErr(reason)
  }

  async #onOutputStart(): Promise<Result<void, ErroredError | ClosedError>> {
    await this.#init()

    const version = new VersionsCell([5])
    this.output.enqueue(OldCell.Circuitless.from(undefined, version))

    return await Plume.tryWaitOrCloseOrError(this.events, "handshaked", (future: Future<Ok<void>>) => {
      future.resolve(Ok.void())
      return new None()
    })
  }

  async #onInputWrite(chunk: Opaque) {
    // Console.debug(this.#class.name, "<-", chunk)

    if (this.#buffer.offset)
      await this.#onReadBuffered(chunk.bytes)
    else
      await this.#onReadDirect(chunk.bytes)

    return Ok.void()
  }

  /**
   * Read from buffer
   * @param chunk 
   * @returns 
   */
  async #onReadBuffered(chunk: Uint8Array) {
    this.#buffer.writeOrThrow(chunk)
    const full = new Uint8Array(this.#buffer.before)

    this.#buffer.offset = 0
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
      const raw = this.#state.type === "none"
        ? Readable.tryReadOrRollback(OldCell.Raw, cursor).ignore()
        : Readable.tryReadOrRollback(Cell.Raw, cursor).ignore()

      if (raw.isErr()) {
        this.#buffer.writeOrThrow(cursor.after)
        break
      }

      const cell = raw.get().unpackOrThrow(this)
      await this.#onCell(cell, this.#state)
    }

    return
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
      return new Err(new InvalidCellError())
    if (cell instanceof OldCell.Circuitless)
      return new Err(new InvalidCellError())

    if (state.type === "versioned")
      return await this.#onVersionedStateCell(cell, state)
    if (state.type === "handshaking")
      return await this.#onHandshakingStateCell(cell, state)
    if (state.type === "handshaked")
      return await this.#onHandshakedStateCell(cell)

    throw new Panic(`Unknown state`)
  }

  async #onNoneStateCell(cell: Cell<Opaque> | OldCell<Opaque>, state: TorNoneState): Promise<Result<void, Error>> {
    if (cell instanceof Cell.Circuitful)
      return new Err(new InvalidCellError())
    if (cell instanceof Cell.Circuitless)
      return new Err(new InvalidCellError())

    if (cell.command === VersionsCell.command)
      return await this.#onVersionsCell(cell, state)

    console.warn(`Unknown pre-version cell ${cell.command}`)
    return Ok.void()
  }

  async #onVersionedStateCell(cell: Cell<Opaque>, state: TorVersionedState) {
    if (cell.command === CertsCell.command)
      return await this.#onCertsCell(cell, state)

    console.warn(`Unknown versioned-state cell ${cell.command}`)
    return Ok.void()
  }

  async #onHandshakingStateCell(cell: Cell<Opaque>, state: TorHandshakingState) {
    if (cell.command === AuthChallengeCell.command)
      return await this.#onAuthChallengeCell(cell, state)
    if (cell.command === NetinfoCell.command)
      return await this.#onNetinfoCell(cell, state)

    console.warn(`Unknown handshaking-state cell ${cell.command}`)
    return Ok.void()
  }

  async #onHandshakedStateCell(cell: Cell<Opaque>) {
    if (cell.command === CreatedFastCell.command)
      return await this.#onCreatedFastCell(cell)
    if (cell.command === DestroyCell.command)
      return await this.#onDestroyCell(cell)
    if (cell.command === RelayCell.command)
      return await this.#onRelayCell(cell)

    console.warn(`Unknown handshaked-state cell ${cell.command}`)
    return Ok.void()
  }

  async #onVersionsCell(cell: OldCell<Opaque>, state: TorNoneState): Promise<Result<void, Error>> {
    return await Result.unthrow(async t => {
      const cell2 = OldCell.Circuitless.intoOrThrow(cell, VersionsCell)

      Console.debug(cell2)

      if (!cell2.fragment.versions.includes(5))
        return new Err(new InvalidTorVersionError())

      this.#state = { ...state, type: "versioned", version: 5 }

      return Ok.void()
    })
  }

  async #onCertsCell(cell: Cell<Opaque>, state: TorVersionedState) {
    const cell2 = Cell.Circuitless.intoOrThrow(cell, CertsCell)

    Console.debug(cell2)

    const certs = await Certs.verifyOrThrow(cell2.fragment.certs)

    const idh = await certs.rsa_self.sha1OrThrow()
    const guard = { certs, idh }

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

    await this.events.emit("handshaked", [])
  }

  async #onCreatedFastCell(cell: Cell<Opaque>) {
    const cell2 = Cell.Circuitful.intoOrThrow(cell, CreatedFastCell)

    Console.debug(cell2)

    await this.events.emit("CREATED_FAST", [cell2])
  }

  async #onDestroyCell(cell: Cell<Opaque>) {
    const cell2 = Cell.Circuitful.intoOrThrow(cell, DestroyCell)

    Console.debug(cell2)

    this.circuits.inner.delete(cell2.circuit.id)

    await this.events.emit("DESTROY", [cell2])
  }

  async #onRelayCell(parent: Cell<Opaque>) {
    const raw = RelayCell.Raw.uncellOrThrow(parent)
    const cell = raw.unpackOrThrow()

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

    await this.events.emit("RELAY_EXTENDED2", [cell2])
  }

  async #onRelayConnectedCell(cell: RelayCell<Opaque>) {
    const cell2 = RelayCell.Streamful.intoOrThrow(cell, RelayConnectedCell)

    Console.debug(cell2)

    await this.events.emit("RELAY_CONNECTED", [cell2])
  }

  async #onRelayDataCell(cell: RelayCell<Opaque>) {
    const cell2 = RelayCell.Streamful.intoOrThrow(cell, RelayDataCell)

    Console.debug(cell2)

    const exit = cell2.circuit.targets[cell2.circuit.targets.length - 1]

    exit.delivery--

    if (exit.delivery === 900) {
      exit.delivery = 1000

      if (cell2.digest20 == null)
        throw new InvalidRelayCellDigestError()

      const digest = new RelaySendmeDigest(cell2.digest20)
      const sendme = new RelaySendmeCircuitCell(1, digest)

      const sendme_cell = RelayCell.Streamless.from(cell2.circuit, undefined, sendme)
      this.output.enqueue(sendme_cell.cellOrThrow())
    }

    await this.events.emit("RELAY_DATA", [cell2])
  }

  async #onRelayEndCell(cell: RelayCell<Opaque>) {
    const cell2 = RelayCell.Streamful.intoOrThrow(cell, RelayEndCell)

    Console.debug(cell2)

    await this.events.emit("RELAY_END", [cell2])
  }

  async #onRelayDropCell(cell: RelayCell<Opaque>) {
    Console.debug(RelayCell.Streamful.intoOrThrow(cell, RelayDropCell))
  }

  async #onRelayTruncatedCell(cell: RelayCell<Opaque>) {
    const cell2 = RelayCell.Streamless.intoOrThrow(cell, RelayTruncatedCell)

    Console.debug(cell2)

    cell2.circuit.targets.pop()

    await this.events.emit("RELAY_TRUNCATED", [cell2])
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

  async #onRelaySendmeStreamCell(cell: RelayCell<Opaque>): Promise<Result<void, Error>> {
    return await Result.unthrow(async t => {
      const cell2 = RelayCell.Streamful.intoOrThrow(cell, RelaySendmeStreamCell)

      Console.debug(cell2)

      cell2.stream.package += 50
      return Ok.void()
    })
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

  async #tryWaitCreatedFast(circuit: SecretCircuit, signal?: AbortSignal): Promise<Result<Cell.Circuitful<CreatedFastCell>, AbortedError | ErroredError | ClosedError>> {
    return await Plume.tryWaitOrCloseOrErrorOrSignal(this.events, "CREATED_FAST", async (future: Future<Ok<Cell.Circuitful<CreatedFastCell>>>, e) => {
      if (e.circuit !== circuit)
        return new None()
      future.resolve(new Ok(e))
      return new None()
    }, AbortSignals.timeout(5_000, signal))
  }

  async tryCreateAndExtendLoop(signal?: AbortSignal): Promise<Result<Circuit, Error>> {
    return await Result.unthrow(async t => {

      for (let i = 0; !this.closed && !signal?.aborted && i < 3; i++) {
        const circuit = await this.tryCreateLoop(signal).then(r => r.throw(t))

        const extend1 = await circuit.tryExtendLoop(false, signal).then(r => r.ignore())

        if (extend1.isOk()) {
          const extend2 = await circuit.tryExtendLoop(true, signal).then(r => r.ignore())

          if (extend2.isOk())
            return new Ok(circuit)

          if (circuit.closed && !this.closed && !signal?.aborted) {
            Console.debug("Create and extend failed", { error: extend2.get() })
            await circuit.close()
            await new Promise(ok => setTimeout(ok, 1000 * (2 ** i)))
            continue
          }

          return extend2
        }

        if (circuit.closed && !this.closed && !signal?.aborted) {
          Console.debug("Create and extend failed", { error: extend1.get() })
          await circuit.close()
          await new Promise(ok => setTimeout(ok, 1000 * (2 ** i)))
          continue
        }

        return extend1
      }

      if (this.closed?.reason != null)
        return new Err(ErroredError.from(this.closed.reason))
      if (this.closed != null)
        return new Err(ClosedError.from(this.closed.reason))
      if (signal?.aborted)
        return new Err(AbortedError.from(signal.reason))
      return new Err(new TooManyRetriesError())
    })
  }

  async tryCreateLoop(signal?: AbortSignal): Promise<Result<Circuit, Error>> {
    for (let i = 0; !this.closed && !signal?.aborted && i < 3; i++) {
      const result = await this.tryCreate(signal)

      if (result.isOk())
        return result

      if (this.closed)
        return result
      if (signal?.aborted)
        return result

      if (result.inner.name === AbortedError.name) {
        Console.debug("Create aborted", { error: result.get() })
        await new Promise(ok => setTimeout(ok, 1000 * (2 ** i)))
        continue
      }

      if (result.inner.name === InvalidKdfKeyHashError.name) {
        Console.debug("Create failed", { error: result.get() })
        await new Promise(ok => setTimeout(ok, 1000 * (2 ** i)))
        continue
      }

      return result
    }

    if (this.closed?.reason != null)
      return new Err(ErroredError.from(this.closed.reason))
    if (this.closed != null)
      return new Err(ClosedError.from(this.closed.reason))
    if (signal?.aborted)
      return new Err(AbortedError.from(signal.reason))
    return new Err(new TooManyRetriesError())
  }

  async createOrThrow(signal?: AbortSignal) {
    if (this.#state.type !== "handshaked")
      throw new InvalidTorStateError()

    const circuit = await this.#createCircuitOrThrow()
    const material = Bytes.random(20)

    const create_fast = new CreateFastCell(material)
    this.output.enqueue(Cell.Circuitful.from(circuit, create_fast))

    const created_fast = await this.#tryWaitCreatedFast(circuit, signal).then(r => r.unwrap())

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

    const target = new Target(this.#state.guard.idh, circuit, forwardDigest, backwardDigest, forwardKey, backwardKey)

    circuit.targets.push(target)

    return new Circuit(circuit)
  }

  async tryCreate(signal?: AbortSignal) {
    return await Result.runAndWrap(async () => {
      return await this.createOrThrow(signal)
    }).then(r => r.mapErrSync(cause => new Error(`Could not create`, { cause })))
  }

}