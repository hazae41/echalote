import { Berith } from "@hazae41/berith";
import { Binary } from "@hazae41/binary";
import { Bytes } from "@hazae41/bytes";
import { TlsStream } from "@hazae41/cadenas";
import { Foras } from "@hazae41/foras";
import { Morax } from "@hazae41/morax";
import { Paimon } from "@hazae41/paimon";
import { Aes128Ctr128BEKey, Zepar } from "@hazae41/zepar";
import { Bitmask } from "libs/bits.js";
import { AbortEvent } from "libs/events/abort.js";
import { CloseEvent } from "libs/events/close.js";
import { ErrorEvent } from "libs/events/error.js";
import { AsyncEventTarget } from "libs/events/target.js";
import { Future } from "libs/futures/future.js";
import { Mutex } from "libs/mutex/mutex.js";
import { kdftor } from "mods/tor/algos/kdftor.js";
import { TypedAddress } from "mods/tor/binary/address.js";
import { Cell, NewCell, OldCell } from "mods/tor/binary/cells/cell.js";
import { AuthChallengeCell } from "mods/tor/binary/cells/direct/auth_challenge/cell.js";
import { Certs, CertsCell } from "mods/tor/binary/cells/direct/certs/cell.js";
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
import { Circuit } from "mods/tor/circuit.js";
import { Authority, parseAuthorities } from "mods/tor/consensus/authorities.js";
import { Target } from "mods/tor/target.js";

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
  id: string,
  eid?: string,
  exit?: boolean,
  onion: number[]
  hosts: string[]
}

export interface TorParams {
  signal?: AbortSignal,
  fallbacks: Fallback[]
}

export class Tor extends AsyncEventTarget {
  readonly #class = Tor

  readonly read = new AsyncEventTarget()
  readonly write = new AsyncEventTarget()

  private reader: TransformStream<Uint8Array>
  private writer: TransformStream<Uint8Array>

  private _input?: TransformStreamDefaultController<Uint8Array>
  private _output?: TransformStreamDefaultController<Uint8Array>

  readonly authorities = new Array<Authority>()
  readonly circuits = new Map<number, Circuit>()

  private tls: TlsStream

  private buffer = Bytes.allocUnsafe(65535)
  private wbinary = new Binary(this.buffer)
  private rbinary = new Binary(this.buffer)

  private state: TorState = { type: "none" }

  /**
   * Create a new Tor client
   * @param tcp Some TCP stream
   * @param params Tor params
   */
  constructor(
    readonly tcp: ReadableWritablePair<Uint8Array>,
    readonly params: TorParams
  ) {
    super()

    const { signal } = params

    this.authorities = parseAuthorities()

    const ciphers = Object.values(TorCiphers)
    const tls = new TlsStream(tcp, { signal, ciphers })

    this.tls = tls

    this.reader = new TransformStream<Uint8Array>({
      start: this.onReadStart.bind(this),
      transform: this.onRead.bind(this),
    })

    this.writer = new TransformStream<Uint8Array>({
      start: this.onWriteStart.bind(this),
    })

    tls.readable
      .pipeTo(this.reader.writable, { signal })
      .then(this.onReadClose.bind(this))
      .catch(this.onReadError.bind(this))

    this.writer.readable
      .pipeTo(tls.writable, { signal })
      .then(this.onWriteClose.bind(this))
      .catch(this.onWriteError.bind(this))

    this.reader.readable
      .pipeTo(new WritableStream())
      .then(() => { })
      .catch(() => { })
  }

  private async init() {
    await Paimon.initBundledOnce()
    await Berith.initBundledOnce()
    await Zepar.initBundledOnce()
    await Morax.initBundledOnce()
    await Foras.initBundledOnce()
  }

  get input() {
    return this._input!
  }

  get output() {
    return this._output!
  }

  private async onReadClose() {
    console.debug(`${this.#class.name}.onReadClose`)

    const closeEvent = new CloseEvent("close", {})
    if (!await this.read.dispatchEvent(closeEvent)) return
  }

  private async onWriteClose() {
    console.debug(`${this.#class.name}.onWriteClose`)

    const closeEvent = new CloseEvent("close", {})
    if (!await this.write.dispatchEvent(closeEvent)) return
  }

  private async onReadError(error?: unknown) {
    console.debug(`${this.#class.name}.onReadError`, error)

    try { this.output!.error(error) } catch (e: unknown) { }

    const errorEvent = new ErrorEvent("error", { error })
    if (!await this.read.dispatchEvent(errorEvent)) return
  }

  private async onWriteError(error?: unknown) {
    console.debug(`${this.#class.name}.onWriteError`, error)

    try { this.input!.error(error) } catch (e: unknown) { }

    const errorEvent = new ErrorEvent("error", { error })
    if (!await this.write.dispatchEvent(errorEvent)) return
  }

  private async onReadStart(controller: TransformStreamDefaultController<Uint8Array>) {
    this._input = controller
  }

  private async onWriteStart(controller: TransformStreamDefaultController<Uint8Array>) {
    this._output = controller
  }

  private async onRead(chunk: Uint8Array) {
    // console.debug("<-", chunk)

    this.wbinary.write(chunk)
    this.rbinary.view = this.buffer.subarray(0, this.wbinary.offset)

    while (this.rbinary.remaining) {
      const rawCell = this.state.type === "none"
        ? OldCell.tryRead(this.rbinary)
        : NewCell.tryRead(this.rbinary)

      if (!rawCell) break

      const cell = rawCell.type === "old"
        ? OldCell.unpack(this, rawCell)
        : NewCell.unpack(this, rawCell)

      await this.onCell(cell)
    }

    if (!this.rbinary.offset)
      return

    if (this.rbinary.offset === this.wbinary.offset) {
      this.rbinary.offset = 0
      this.wbinary.offset = 0
      return
    }

    if (this.rbinary.remaining && this.wbinary.remaining < 4096) {
      console.debug(`${this.#class.name}`, `Reallocating buffer`)

      const remaining = this.buffer.subarray(this.rbinary.offset, this.wbinary.offset)

      this.rbinary.offset = 0
      this.wbinary.offset = 0

      this.buffer = Bytes.allocUnsafe(4 * 4096)
      this.rbinary.view = this.buffer
      this.wbinary.view = this.buffer

      this.wbinary.write(remaining)
      return
    }
  }

  private async onCell(cell: Cell) {
    if (cell.command === PaddingCell.command)
      return console.debug(`PADDING`, cell)
    if (cell.command === VariablePaddingCell.command)
      return console.debug(`VPADDING`, cell)

    if (this.state.type === "none")
      return await this.onNoneStateCell(cell)
    if (cell instanceof OldCell)
      throw new Error(`Can't uncell post-version cell from old cell`)

    if (this.state.type === "versioned")
      return await this.onVersionedStateCell(cell)
    if (this.state.type === "handshaking")
      return await this.onHandshakingStateCell(cell)
    if (this.state.type === "handshaked")
      return await this.onHandshakedStateCell(cell)

    throw new Error(`Unknown state`)
  }

  private async onNoneStateCell(cell: Cell) {
    if (this.state.type !== "none")
      throw new Error(`State is not none`)
    if (cell instanceof NewCell)
      throw new Error(`Can't uncell pre-version cell from new cell`)

    if (cell.command === VersionsCell.command)
      return await this.onVersionsCell(cell)

    console.debug(`Unknown pre-version cell ${cell.command}`)
  }

  private async onVersionedStateCell(cell: NewCell) {
    if (this.state.type !== "versioned")
      throw new Error(`State is not versioned`)

    if (cell.command === CertsCell.command)
      return await this.onCertsCell(cell)

    console.debug(`Unknown versioned-state cell ${cell.command}`)
  }

  private async onHandshakingStateCell(cell: NewCell) {
    if (this.state.type !== "handshaking")
      throw new Error(`State is not handshaking`)

    if (cell.command === AuthChallengeCell.command)
      return await this.onAuthChallengeCell(cell)
    if (cell.command === NetinfoCell.command)
      return await this.onNetinfoCell(cell)

    console.debug(`Unknown handshaking-state cell ${cell.command}`)
  }

  private async onHandshakedStateCell(cell: NewCell) {
    if (cell.command === CreatedFastCell.command)
      return await this.onCreatedFastCell(cell)
    if (cell.command === DestroyCell.command)
      return await this.onDestroyCell(cell)
    if (cell.command === RelayCell.command)
      return await this.onRelayCell(cell)

    console.debug(`Unknown handshaked-state cell ${cell.command}`)
  }

  private async onVersionsCell(cell: OldCell) {
    if (this.state.type !== "none")
      throw new Error(`State is not none`)

    const data = VersionsCell.uncell(cell)

    console.debug(`VERSIONS`, data)

    const cellEvent = new MessageEvent("VERSIONS", { data })
    if (!await this.dispatchEvent(cellEvent)) return

    if (!data.versions.includes(5))
      throw new Error(`Incompatible versions`)

    this.state = { type: "versioned", version: 5 }

    const stateEvent = new MessageEvent("versioned", { data: 5 })
    if (!await this.dispatchEvent(stateEvent)) return
  }

  private async onCertsCell(cell: NewCell) {
    if (this.state.type !== "versioned")
      throw new Error(`State is not versioned`)

    const data = CertsCell.uncell(cell)

    console.debug(`CERTS`, data)

    const cellEvent = new MessageEvent("CERTS", { data })
    if (!await this.dispatchEvent(cellEvent)) return

    const idh = await data.getIdHash()

    await data.checkId()
    await data.checkIdToTls()
    await data.checkIdToEid()
    data.checkEidToSigning()
    data.checkSigningToTls()

    const { certs } = data
    const guard = { certs, idh }

    const { version } = this.state
    this.state = { type: "handshaking", version, guard }

    const stateEvent = new MessageEvent("handshaking", {})
    if (!await this.dispatchEvent(stateEvent)) return
  }

  private async onAuthChallengeCell(cell: NewCell) {
    if (this.state.type !== "handshaking")
      throw new Error(`State is not handshaking`)

    const data = AuthChallengeCell.uncell(cell)

    console.debug(`AUTH_CHALLENGE`, data)

    const cellEvent = new MessageEvent("AUTH_CHALLENGE", { data })
    if (!await this.dispatchEvent(cellEvent)) return
  }

  private async onNetinfoCell(cell: NewCell) {
    if (this.state.type !== "handshaking")
      throw new Error(`State is not handshaking`)

    const data = NetinfoCell.uncell(cell)

    console.debug(`NETINFO`, data)

    const cellEvent = new MessageEvent("NETINFO", { data })
    if (!await this.dispatchEvent(cellEvent)) return

    const address = new TypedAddress(4, new Uint8Array([127, 0, 0, 1]))
    const netinfo = new NetinfoCell(undefined, 0, address, [])
    this._output!.enqueue(netinfo.pack())

    const pversion = PaddingNegociateCell.versions.ZERO
    const pcommand = PaddingNegociateCell.commands.STOP
    const padding = new PaddingNegociateCell(undefined, pversion, pcommand, 0, 0)
    this._output!.enqueue(padding.pack())

    const { version, guard } = this.state
    this.state = { type: "handshaked", version, guard }

    const stateEvent = new MessageEvent("handshake", {})
    if (!await this.dispatchEvent(stateEvent)) return
  }

  private async onCreatedFastCell(cell: NewCell) {
    const data = CreatedFastCell.uncell(cell)

    console.debug(`CREATED_FAST`, data)

    const cellEvent = new MessageEvent("CREATED_FAST", { data })
    if (!await this.dispatchEvent(cellEvent)) return
  }

  private async onDestroyCell(cell: NewCell) {
    const data = DestroyCell.uncell(cell)

    console.debug(`DESTROY`, data)

    const cellEvent = new MessageEvent("DESTROY", { data })
    if (!await this.dispatchEvent(cellEvent)) return

    this.circuits.delete(data.circuit.id)
  }

  private async onRelayCell(parent: NewCell) {
    const cell = await RelayCell.uncell(parent)

    if (cell.rcommand === RelayExtended2Cell.rcommand)
      return await this.onRelayExtended2Cell(cell)
    if (cell.rcommand === RelayConnectedCell.rcommand)
      return await this.onRelayConnectedCell(cell)
    if (cell.rcommand === RelayDataCell.rcommand)
      return await this.onRelayDataCell(cell)
    if (cell.rcommand === RelayEndCell.rcommand)
      return await this.onRelayEndCell(cell)
    if (cell.rcommand === RelayDropCell.rcommand)
      return await this.onRelayDropCell(cell)
    if (cell.rcommand === RelayTruncatedCell.rcommand)
      return await this.onRelayTruncatedCell(cell)

    console.debug(`Unknown relay cell ${cell.rcommand}`)
  }

  private async onRelayExtended2Cell(cell: RelayCell) {
    const data = RelayExtended2Cell.uncell(cell)

    console.debug(`RELAY_EXTENDED2`, data)

    const cellEvent = new MessageEvent("RELAY_EXTENDED2", { data })
    if (!await this.dispatchEvent(cellEvent)) return
  }

  private async onRelayConnectedCell(cell: RelayCell) {
    const data = RelayConnectedCell.uncell(cell)

    console.debug(`RELAY_CONNECTED`, data)

    const cellEvent = new MessageEvent("RELAY_CONNECTED", { data })
    if (!await this.dispatchEvent(cellEvent)) return
  }

  private async onRelayDataCell(cell: RelayCell) {
    const data = RelayDataCell.uncell(cell)

    console.debug(`RELAY_DATA`, data)

    const cellEvent = new MessageEvent("RELAY_DATA", { data })
    if (!await this.dispatchEvent(cellEvent)) return
  }

  private async onRelayEndCell(cell: RelayCell) {
    const data = RelayEndCell.uncell(cell)

    console.debug(`RELAY_END`, data)

    const cellEvent = new MessageEvent("RELAY_END", { data })
    if (!await this.dispatchEvent(cellEvent)) return
  }

  private async onRelayDropCell(cell: RelayCell) {
    const data = RelayDropCell.uncell(cell)

    console.debug(`RELAY_DROP`, data)

    const cellEvent = new MessageEvent("RELAY_DROP", { data })
    if (!await this.dispatchEvent(cellEvent)) return
  }

  private async onRelayTruncatedCell(cell: RelayCell) {
    const data = RelayTruncatedCell.uncell(cell)

    console.debug(`RELAY_TRUNCATED`, data)

    const cellEvent = new MessageEvent("RELAY_TRUNCATED", { data })
    if (!await this.dispatchEvent(cellEvent)) return

    data.circuit.targets.pop()
  }

  private async waitHandshake(signal?: AbortSignal) {
    const future = new Future<Event, Error>()

    const onAbort = (event: Event) => {
      const abortEvent = event as AbortEvent
      const error = new Error(`Aborted`, { cause: abortEvent.target.reason })
      future.err(error)
    }

    const onClose = (event: Event) => {
      const closeEvent = event as CloseEvent
      const error = new Error(`Closed`, { cause: closeEvent })
      future.err(error)
    }

    const onError = (event: Event) => {
      const errorEvent = event as ErrorEvent
      const error = new Error(`Errored`, { cause: errorEvent })
      future.err(error)
    }

    try {
      signal?.addEventListener("abort", onAbort, { passive: true })
      this.read.addEventListener("close", onClose, { passive: true })
      this.read.addEventListener("error", onError, { passive: true })
      this.addEventListener("handshake", future.ok, { passive: true })

      await future.promise
    } finally {
      signal?.removeEventListener("abort", onAbort)
      this.read.removeEventListener("close", onClose)
      this.read.removeEventListener("error", onError)
      this.removeEventListener("handshake", future.ok)
    }
  }

  async handshake(signal?: AbortSignal) {
    await this.init()

    await this.tls.handshake(signal)

    const handshake = this.waitHandshake(signal)

    const version = new VersionsCell(undefined, [5])
    this._output!.enqueue(version.pack())

    await handshake
  }

  private async waitCreatedFast(circuit: Circuit, signal?: AbortSignal) {
    const future = new Future<CreatedFastCell, Error>()

    const onCreatedFastCell = (event: Event) => {
      const msgEvent = event as MessageEvent<CreatedFastCell>
      if (msgEvent.data.circuit !== circuit) return
      future.ok(msgEvent.data)
    }

    const onAbort = (event: Event) => {
      const abortEvent = event as AbortEvent
      const error = new Error(`Aborted`, { cause: abortEvent.target.reason })
      future.err(error)
    }

    const onClose = (event: Event) => {
      const closeEvent = event as CloseEvent
      const error = new Error(`Closed`, { cause: closeEvent })
      future.err(error)
    }

    const onError = (event: Event) => {
      const errorEvent = event as ErrorEvent
      const error = new Error(`Errored`, { cause: errorEvent })
      future.err(error)
    }

    try {
      signal?.addEventListener("abort", onAbort, { passive: true })
      this.read.addEventListener("close", onClose, { passive: true })
      this.read.addEventListener("error", onError, { passive: true })
      this.addEventListener("CREATED_FAST", onCreatedFastCell, { passive: true })

      return await future.promise
    } finally {
      signal?.removeEventListener("abort", onAbort)
      this.read.removeEventListener("close", onClose)
      this.read.removeEventListener("error", onError)
      this.removeEventListener("CREATED_FAST", onCreatedFastCell)
    }
  }

  private circuitsMutex = new Mutex()

  private async createCircuitAtomic() {
    return await this.circuitsMutex.lock(async () => {
      while (true) {
        const rawCircuitId = new Binary(Bytes.random(4)).getUint32()
        if (rawCircuitId === 0) continue

        const circuitId = new Bitmask(rawCircuitId).set(31, true).export()
        if (this.circuits.has(circuitId)) continue

        const circuit = new Circuit(this, circuitId)
        this.circuits.set(circuitId, circuit)

        return circuit
      }
    })
  }

  async create(signal?: AbortSignal) {
    if (this.state.type !== "handshaked")
      throw new Error(`Can't create a circuit yet`)

    const circuit = await this.createCircuitAtomic()
    const material = Bytes.random(20)

    const pcreated = this.waitCreatedFast(circuit, signal)
    const create_fast = new CreateFastCell(circuit, material)
    this._output!.enqueue(create_fast.pack())

    const created = await pcreated

    const k0 = Bytes.concat([material, created.material])
    const result = await kdftor(k0)

    if (!Bytes.equals(result.keyHash, created.derivative))
      throw new Error(`Invalid KDF-TOR key hash`)

    const forwardDigest = new Morax.Sha1Hasher()
    const backwardDigest = new Morax.Sha1Hasher()

    forwardDigest.update(result.forwardDigest)
    backwardDigest.update(result.backwardDigest)

    const forwardKey = new Aes128Ctr128BEKey(result.forwardKey, Bytes.alloc(16))
    const backwardKey = new Aes128Ctr128BEKey(result.backwardKey, Bytes.alloc(16))

    const target = new Target(this.state.guard.idh, circuit, forwardDigest, backwardDigest, forwardKey, backwardKey)

    circuit.targets.push(target)

    return circuit
  }
}