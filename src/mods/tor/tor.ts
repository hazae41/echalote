import { Berith } from "@hazae41/berith";
import { Cursor, Opaque, Readable, Writable } from "@hazae41/binary";
import { Bitset } from "@hazae41/bitset";
import { Bytes } from "@hazae41/bytes";
import { TlsClientDuplex } from "@hazae41/cadenas";
import { Foras } from "@hazae41/foras";
import { Future } from "@hazae41/future";
import { Morax } from "@hazae41/morax";
import { Mutex } from "@hazae41/mutex";
import { Paimon } from "@hazae41/paimon";
import { Aes128Ctr128BEKey, Zepar } from "@hazae41/zepar";
import { CloseAndErrorEvents, Events } from "libs/events/events.js";
import { AsyncEventTarget } from "libs/events/target.js";
import { SuperTransformStream } from "libs/streams/transform.js";
import { kdftor } from "mods/tor/algorithms/kdftor.js";
import { TypedAddress } from "mods/tor/binary/address.js";
import { Cell, OldCell, RawCell, RawOldCell } from "mods/tor/binary/cells/cell.js";
import { AuthChallengeCell } from "mods/tor/binary/cells/direct/auth_challenge/cell.js";
import { CertsCell, CertsObject } from "mods/tor/binary/cells/direct/certs/cell.js";
import { CreatedFastCell } from "mods/tor/binary/cells/direct/created_fast/cell.js";
import { CreateFastCell } from "mods/tor/binary/cells/direct/create_fast/cell.js";
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
import { LoopParams } from "mods/tor/types/loop.js";

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
  readonly certs: CertsObject
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
    readonly tcp: ReadableWritablePair<Opaque, Writable>,
    readonly params: TorClientParams
  ) {
    this.#secret = new SecretTorClientDuplex(tcp, params)
  }

  async tryCreateAndExtend(params: LoopParams = {}) {
    return await this.#secret.tryCreateAndExtend(params)
  }

  async tryCreate(params: LoopParams = {}) {
    return await this.#secret.tryCreate(params)
  }

  async create(signal?: AbortSignal) {
    return await this.#secret.create(signal)
  }

}

export type SecretTorEvents = CloseAndErrorEvents & {
  "handshaked": Event,

  "VERSIONS": MessageEvent<VersionsCell>
  "CERTS": MessageEvent<CertsCell>
  "AUTH_CHALLENGE": MessageEvent<AuthChallengeCell>
  "NETINFO": MessageEvent<NetinfoCell>
  "CREATED_FAST": MessageEvent<CreatedFastCell>,
  "DESTROY": MessageEvent<DestroyCell>,
  "RELAY_CONNECTED": MessageEvent<RelayConnectedCell>,
  "RELAY_DATA": MessageEvent<RelayDataCell<Opaque>>,
  "RELAY_DROP": MessageEvent<RelayDropCell<Opaque>>
  "RELAY_EXTENDED2": MessageEvent<RelayExtended2Cell<Opaque>>,
  "RELAY_TRUNCATED": MessageEvent<RelayTruncatedCell>,
  "RELAY_END": MessageEvent<RelayEndCell>
}

export class SecretTorClientDuplex {
  readonly #class = SecretTorClientDuplex

  readonly events = new AsyncEventTarget<SecretTorEvents>()

  readonly reader: SuperTransformStream<Opaque, Opaque>
  readonly writer: SuperTransformStream<Writable, Writable>

  readonly authorities = new Array<Authority>()
  readonly circuits = new Map<number, SecretCircuit>()

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

    write.readable
      .pipeTo(tls.writable, { signal })
      .then(this.#onWriteClose.bind(this))
      .catch(this.#onWriteError.bind(this))

    read.readable
      .pipeTo(new WritableStream())
      .then(() => { })
      .catch(() => { })
  }

  async #init() {
    await Paimon.initBundledOnce()
    await Berith.initBundledOnce()
    await Zepar.initBundledOnce()
    await Morax.initBundledOnce()
    await Foras.initBundledOnce()
  }

  get closed() {
    return this.reader.closed
  }

  async #onReadClose() {
    console.debug(`${this.#class.name}.onReadClose`)

    this.reader.closed = {}

    const closeEvent = new CloseEvent("close", {})
    await this.events.dispatchEvent(closeEvent, "close")
  }

  async #onReadError(reason?: unknown) {
    console.debug(`${this.#class.name}.onReadError`, reason)

    this.reader.closed = { reason }
    this.writer.error(reason)

    const error = new Error(`Errored`, { cause: reason })
    const errorEvent = new ErrorEvent("error", { error })
    await this.events.dispatchEvent(errorEvent, "error")
  }

  async #onWriteClose() {
    console.debug(`${this.#class.name}.onWriteClose`)

    this.writer.closed = {}
  }

  async #onWriteError(reason?: unknown) {
    console.debug(`${this.#class.name}.onWriteError`, reason)

    this.writer.closed = { reason }
    this.reader.error(reason)
  }

  async #onWriteStart() {
    await this.#init()

    const version = new VersionsCell(undefined, [5])
    this.writer.enqueue(OldCell.from(version))

    await Events.wait(this.events, "handshaked")
  }

  async #onRead(chunk: Opaque) {
    // console.debug(this.#class.name, "<-", chunk)

    if (this.#buffer.offset)
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
    this.#buffer.write(chunk)
    const full = this.#buffer.before

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
        ? Readable.tryRead(RawOldCell, cursor)
        : Readable.tryRead(RawCell, cursor)

      if (!raw) {
        this.#buffer.write(cursor.after)
        break
      }

      const cell = raw.unpack(this)
      await this.#onCell(cell)
    }
  }

  async #onCell(cell: Cell<Opaque> | OldCell<Opaque>) {
    if (cell.command === PaddingCell.command)
      return console.debug(`PADDING`, cell)
    if (cell.command === VariablePaddingCell.command)
      return console.debug(`VPADDING`, cell)

    if (this.#state.type === "none")
      return await this.#onNoneStateCell(cell)
    if (cell instanceof OldCell)
      throw new Error(`Can't uncell post-version cell from old cell`)

    if (this.#state.type === "versioned")
      return await this.#onVersionedStateCell(cell)
    if (this.#state.type === "handshaking")
      return await this.#onHandshakingStateCell(cell)
    if (this.#state.type === "handshaked")
      return await this.#onHandshakedStateCell(cell)

    throw new Error(`Unknown state`)
  }

  async #onNoneStateCell(cell: Cell<Opaque> | OldCell<Opaque>) {
    if (this.#state.type !== "none")
      throw new Error(`State is not none`)
    if (cell instanceof Cell)
      throw new Error(`Can't uncell pre-version cell from new cell`)

    if (cell.command === VersionsCell.command)
      return await this.#onVersionsCell(cell)

    console.debug(`Unknown pre-version cell ${cell.command}`)
  }

  async #onVersionedStateCell(cell: Cell<Opaque>) {
    if (this.#state.type !== "versioned")
      throw new Error(`State is not versioned`)

    if (cell.command === CertsCell.command)
      return await this.#onCertsCell(cell)

    console.debug(`Unknown versioned-state cell ${cell.command}`)
  }

  async #onHandshakingStateCell(cell: Cell<Opaque>) {
    if (this.#state.type !== "handshaking")
      throw new Error(`State is not handshaking`)

    if (cell.command === AuthChallengeCell.command)
      return await this.#onAuthChallengeCell(cell)
    if (cell.command === NetinfoCell.command)
      return await this.#onNetinfoCell(cell)

    console.debug(`Unknown handshaking-state cell ${cell.command}`)
  }

  async #onHandshakedStateCell(cell: Cell<Opaque>) {
    if (cell.command === CreatedFastCell.command)
      return await this.#onCreatedFastCell(cell)
    if (cell.command === DestroyCell.command)
      return await this.#onDestroyCell(cell)
    if (cell.command === RelayCell.command)
      return await this.#onRelayCell(cell)

    console.debug(`Unknown handshaked-state cell ${cell.command}`)
  }

  async #onVersionsCell(cell: OldCell<Opaque>) {
    if (this.#state.type !== "none")
      throw new Error(`State is not none`)

    const data = VersionsCell.uncell(cell)

    console.debug(`VERSIONS`, data)

    const cellEvent = new MessageEvent("VERSIONS", { data })
    await this.events.dispatchEvent(cellEvent, "VERSIONS")

    if (!data.versions.includes(5))
      throw new Error(`Incompatible versions`)

    this.#state = { type: "versioned", version: 5 }
  }

  async #onCertsCell(cell: Cell<Opaque>) {
    if (this.#state.type !== "versioned")
      throw new Error(`State is not versioned`)

    const data = CertsCell.uncell(cell)

    console.debug(`CERTS`, data)

    const cellEvent = new MessageEvent("CERTS", { data })
    await this.events.dispatchEvent(cellEvent, "CERTS")

    const idh = await data.getIdHash()

    await data.checkId()
    await data.checkIdToTls()
    await data.checkIdToEid()
    data.checkEidToSigning()
    data.checkSigningToTls()

    const { certs } = data
    const guard = { certs, idh }

    const { version } = this.#state
    this.#state = { type: "handshaking", version, guard }
  }

  async #onAuthChallengeCell(cell: Cell<Opaque>) {
    if (this.#state.type !== "handshaking")
      throw new Error(`State is not handshaking`)

    const data = AuthChallengeCell.uncell(cell)

    console.debug(`AUTH_CHALLENGE`, data)

    const cellEvent = new MessageEvent("AUTH_CHALLENGE", { data })
    await this.events.dispatchEvent(cellEvent, "AUTH_CHALLENGE")
  }

  async #onNetinfoCell(cell: Cell<Opaque>) {
    if (this.#state.type !== "handshaking")
      throw new Error(`State is not handshaking`)

    const data = NetinfoCell.uncell(cell)

    console.debug(`NETINFO`, data)

    const cellEvent = new MessageEvent("NETINFO", { data })
    await this.events.dispatchEvent(cellEvent, "NETINFO")

    const address = new TypedAddress(4, new Uint8Array([127, 0, 0, 1]))
    const netinfo = new NetinfoCell(undefined, 0, address, [])
    this.writer.enqueue(Cell.from(netinfo))

    const pversion = PaddingNegociateCell.versions.ZERO
    const pcommand = PaddingNegociateCell.commands.STOP
    const padding_negociate = new PaddingNegociateCell(undefined, pversion, pcommand, 0, 0)
    this.writer.enqueue(Cell.from(padding_negociate))

    const { version, guard } = this.#state
    this.#state = { type: "handshaked", version, guard }

    const stateEvent = new Event("handshaked", {})
    await this.events.dispatchEvent(stateEvent, "handshaked")
  }

  async #onCreatedFastCell(cell: Cell<Opaque>) {
    const data = CreatedFastCell.uncell(cell)

    console.debug(`CREATED_FAST`, data)

    const cellEvent = new MessageEvent("CREATED_FAST", { data })
    await this.events.dispatchEvent(cellEvent, "CREATED_FAST")
  }

  async #onDestroyCell(cell: Cell<Opaque>) {
    const data = DestroyCell.uncell(cell)

    console.debug(`DESTROY`, data)

    const cellEvent = new MessageEvent("DESTROY", { data })
    await this.events.dispatchEvent(cellEvent, "DESTROY")

    this.circuits.delete(data.circuit.id)
  }

  async #onRelayCell(parent: Cell<Opaque>) {
    const cell = await RelayCell.uncell(parent)

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
  }

  async #onRelayExtended2Cell(cell: RelayCell<Opaque>) {
    const data = RelayExtended2Cell.uncell(cell)

    console.debug(`RELAY_EXTENDED2`, data)

    const cellEvent = new MessageEvent("RELAY_EXTENDED2", { data })
    await this.events.dispatchEvent(cellEvent, "RELAY_EXTENDED2")
  }

  async #onRelayConnectedCell(cell: RelayCell<Opaque>) {
    const data = RelayConnectedCell.uncell(cell)

    console.debug(`RELAY_CONNECTED`, data)

    const cellEvent = new MessageEvent("RELAY_CONNECTED", { data })
    await this.events.dispatchEvent(cellEvent, "RELAY_CONNECTED")
  }

  async #onRelayDataCell(cell: RelayCell<Opaque>) {
    const data = RelayDataCell.uncell(cell)

    console.debug(`RELAY_DATA`, data)

    const cellEvent = new MessageEvent("RELAY_DATA", { data })
    await this.events.dispatchEvent(cellEvent, "RELAY_DATA")
  }

  async #onRelayEndCell(cell: RelayCell<Opaque>) {
    const data = RelayEndCell.uncell(cell)

    console.debug(`RELAY_END`, data)

    const cellEvent = new MessageEvent("RELAY_END", { data })
    await this.events.dispatchEvent(cellEvent, "RELAY_END")
  }

  async #onRelayDropCell(cell: RelayCell<Opaque>) {
    const data = RelayDropCell.uncell(cell)

    console.debug(`RELAY_DROP`, data)

    const cellEvent = new MessageEvent("RELAY_DROP", { data })
    await this.events.dispatchEvent(cellEvent, "RELAY_DROP")
  }

  async #onRelayTruncatedCell(cell: RelayCell<Opaque>) {
    const data = RelayTruncatedCell.uncell(cell)

    console.debug(`RELAY_TRUNCATED`, data)

    const cellEvent = new MessageEvent("RELAY_TRUNCATED", { data })
    await this.events.dispatchEvent(cellEvent, "RELAY_TRUNCATED")

    data.circuit.targets.pop()
  }

  readonly #circuitsMutex = new Mutex()

  async #createCircuitAtomic() {
    return await this.#circuitsMutex.lock(async () => {
      while (true) {
        const rawCircuitId = new Cursor(Bytes.random(4)).getUint32()
        if (rawCircuitId === 0) continue

        const circuitId = new Bitset(rawCircuitId, 32)
          .enableBE(0)
          .unsign()
          .value
        if (this.circuits.has(circuitId)) continue

        const circuit = new SecretCircuit(circuitId, this)
        this.circuits.set(circuitId, circuit)

        return circuit
      }
    })
  }

  async #waitCreatedFast(circuit: SecretCircuit, signal?: AbortSignal) {
    const future = new Future<CreatedFastCell>()

    const onEvent = (event: MessageEvent<CreatedFastCell>) => {
      if (event.data.circuit !== circuit) return
      future.resolve(event.data)
    }

    return await Events.waitFor(this.events, "CREATED_FAST", { future, onEvent, signal })
  }

  async tryCreateAndExtend(params: LoopParams = {}) {
    const { signal, delay = 1000 } = params

    while (!this.closed) {
      try {
        const circuit = await this.tryCreate(params)
        await circuit.tryExtend(false, params)
        await circuit.tryExtend(true, params)
        return circuit
      } catch (e: unknown) {
        if (signal?.aborted) throw e

        console.warn("Create and extend failed", e)
        await new Promise(ok => setTimeout(ok, delay))
      }
    }

    throw new Error(`Closed`, { cause: this.closed.reason })
  }

  async tryCreate(params: LoopParams = {}) {
    const { signal, timeout = 5000, delay = 1000 } = params

    while (!this.closed) {
      try {
        const signal = AbortSignal.timeout(timeout)
        return await this.create(signal)
      } catch (e: unknown) {
        if (signal?.aborted) throw e

        console.warn("Create failed", e)
        await new Promise(ok => setTimeout(ok, delay))
      }
    }

    throw new Error(`Closed`, { cause: this.closed.reason })
  }

  async create(signal?: AbortSignal) {
    if (this.#state.type !== "handshaked")
      throw new Error(`Can't create a circuit yet`)

    const circuit = await this.#createCircuitAtomic()
    const material = Bytes.random(20)

    const create_fast = new CreateFastCell(circuit, material)
    this.writer.enqueue(Cell.from(create_fast))

    const created_fast = await this.#waitCreatedFast(circuit, signal)

    const k0 = Bytes.concat([material, created_fast.material])
    const result = await kdftor(k0)

    if (!Bytes.equals(result.keyHash, created_fast.derivative))
      throw new Error(`Invalid KDF-TOR key hash`)

    const forwardDigest = new Morax.Sha1Hasher()
    const backwardDigest = new Morax.Sha1Hasher()

    forwardDigest.update(result.forwardDigest)
    backwardDigest.update(result.backwardDigest)

    const forwardKey = new Aes128Ctr128BEKey(result.forwardKey, Bytes.alloc(16))
    const backwardKey = new Aes128Ctr128BEKey(result.backwardKey, Bytes.alloc(16))

    const target = new Target(this.#state.guard.idh, circuit, forwardDigest, backwardDigest, forwardKey, backwardKey)

    circuit.targets.push(target)

    return new Circuit(circuit)
  }
}