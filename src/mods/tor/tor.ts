import { Berith } from "@hazae41/berith";
import { Binary } from "@hazae41/binary";
import { TlsStream } from "@hazae41/cadenas";
import { Foras } from "@hazae41/foras";
import { Morax } from "@hazae41/morax";
import { Paimon } from "@hazae41/paimon";
import { Aes128Ctr128BEKey, Zepar } from "@hazae41/zepar";
import { Bitmask } from "libs/bits.js";
import { Bytes } from "libs/bytes/bytes.js";
import { CloseEvent } from "libs/events/close.js";
import { ErrorEvent } from "libs/events/error.js";
import { Events } from "libs/events/events.js";
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
  readonly read = new AsyncEventTarget()
  readonly write = new AsyncEventTarget()

  private _state: TorState = { type: "none" }

  readonly authorities = new Array<Authority>()
  readonly circuits = new Map<number, Circuit>()

  private _input?: TransformStreamDefaultController<Uint8Array>
  private _output?: TransformStreamDefaultController<Uint8Array>

  private _tls: TlsStream

  private buffer = Bytes.allocUnsafe(4 * 4096)
  private wbinary = new Binary(this.buffer)
  private rbinary = new Binary(this.buffer)

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

    this._tls = tls

    const read = new TransformStream<Uint8Array>({
      start: this.onReadStart.bind(this),
      transform: this.onRead.bind(this),
    })

    const write = new TransformStream<Uint8Array>({
      start: this.onWriteStart.bind(this),
    })

    tls.readable
      .pipeTo(read.writable, { signal })
      .then(this.onReadClose.bind(this))
      .catch(this.onReadError.bind(this))

    write.readable
      .pipeTo(tls.writable, { signal })
      .then(this.onWriteClose.bind(this))
      .catch(this.onWriteError.bind(this))

    const trash = new WritableStream()

    read.readable
      .pipeTo(trash, { signal })
      .then(this.onReadClose.bind(this))
      .catch(this.onReadError.bind(this))

    const onError = this.onError.bind(this)

    this.read.addEventListener("error", onError, { passive: true })
    this.write.addEventListener("error", onError, { passive: true })

    tls.read.addEventListener("error", onError, { passive: true })
    tls.write.addEventListener("error", onError, { passive: true })
  }

  private async init() {
    await Paimon.initBundledOnce()
    await Berith.initBundledOnce()
    await Zepar.initBundledOnce()
    await Morax.initBundledOnce()
    await Foras.initBundledOnce()
  }

  get state() {
    return this._state
  }

  get input() {
    return this._input!
  }

  get output() {
    return this._output!
  }

  private async onReadClose() {
    const closeEvent = new CloseEvent("close", {})
    if (!await this.read.dispatchEvent(closeEvent)) return
  }

  private async onWriteClose() {
    const closeEvent = new CloseEvent("close", {})
    if (!await this.write.dispatchEvent(closeEvent)) return
  }

  private async onReadError(error?: unknown) {
    const errorEvent = new ErrorEvent("error", { error })
    if (!await this.read.dispatchEvent(errorEvent)) return
  }

  private async onWriteError(error?: unknown) {
    const errorEvent = new ErrorEvent("error", { error })
    if (!await this.write.dispatchEvent(errorEvent)) return
  }

  private async onError(e: Event) {
    const errorEvent = e as ErrorEvent

    const errorEventClone = Events.clone(errorEvent)
    if (!await this.dispatchEvent(errorEventClone)) return

    try { this.input.error(errorEvent.error) } catch (e: unknown) { }
    try { this.output.error(errorEvent.error) } catch (e: unknown) { }
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
      const rawCell = this._state.type === "none"
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
      console.debug(`Reallocating buffer`)

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
      return console.debug(`Received PADDING cell`)
    if (cell.command === VariablePaddingCell.command)
      return console.debug(`Received VPADDING cell`)

    if (this._state.type === "none")
      return await this.onNoneStateCell(cell)
    if (cell instanceof OldCell)
      throw new Error(`Can't uncell post-version cell from old cell`)

    if (this._state.type === "versioned")
      return await this.onVersionedStateCell(cell)
    if (this._state.type === "handshaking")
      return await this.onHandshakingStateCell(cell)
    if (this._state.type === "handshaked")
      return await this.onHandshakedStateCell(cell)

    throw new Error(`Unknown state`)
  }

  private async onNoneStateCell(cell: Cell) {
    if (this._state.type !== "none")
      throw new Error(`State is not none`)
    if (cell instanceof NewCell)
      throw new Error(`Can't uncell pre-version cell from new cell`)

    if (cell.command === VersionsCell.command)
      return await this.onVersionsCell(cell)

    console.debug(`Unknown pre-version cell ${cell.command}`)
  }

  private async onVersionedStateCell(cell: NewCell) {
    if (this._state.type !== "versioned")
      throw new Error(`State is not versioned`)

    if (cell.command === CertsCell.command)
      return await this.onCertsCell(cell)

    console.debug(`Unknown versioned-state cell ${cell.command}`)
  }

  private async onHandshakingStateCell(cell: NewCell) {
    if (this._state.type !== "handshaking")
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
    if (this._state.type !== "none")
      throw new Error(`State is not none`)

    const data = VersionsCell.uncell(cell)

    const cellEvent = new MessageEvent("VERSIONS", { data })
    if (!await this.dispatchEvent(cellEvent)) return

    if (!data.versions.includes(5))
      throw new Error(`Incompatible versions`)

    this._state = { type: "versioned", version: 5 }

    const stateEvent = new MessageEvent("versioned", { data: 5 })
    if (!await this.dispatchEvent(stateEvent)) return

    console.debug(`VERSIONS`, data)
  }

  private async onCertsCell(cell: NewCell) {
    if (this._state.type !== "versioned")
      throw new Error(`State is not versioned`)

    const data = CertsCell.uncell(cell)

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

    const { version } = this._state
    this._state = { type: "handshaking", version, guard }

    const stateEvent = new MessageEvent("handshaking", {})
    if (!await this.dispatchEvent(stateEvent)) return

    console.debug(`CERTS`, data)
  }

  private async onAuthChallengeCell(cell: NewCell) {
    if (this._state.type !== "handshaking")
      throw new Error(`State is not handshaking`)

    const data = AuthChallengeCell.uncell(cell)

    const cellEvent = new MessageEvent("AUTH_CHALLENGE", { data })
    if (!await this.dispatchEvent(cellEvent)) return

    console.debug(`AUTH_CHALLENGE`, data)
  }

  private async onNetinfoCell(cell: NewCell) {
    if (this._state.type !== "handshaking")
      throw new Error(`State is not handshaking`)

    const data = NetinfoCell.uncell(cell)

    const cellEvent = new MessageEvent("NETINFO", { data })
    if (!await this.dispatchEvent(cellEvent)) return

    const address = new TypedAddress(4, new Uint8Array([127, 0, 0, 1]))
    const netinfo = new NetinfoCell(undefined, 0, address, [])
    this.output.enqueue(netinfo.pack())

    const pversion = PaddingNegociateCell.versions.ZERO
    const pcommand = PaddingNegociateCell.commands.STOP
    const padding = new PaddingNegociateCell(undefined, pversion, pcommand, 0, 0)
    this.output.enqueue(padding.pack())

    const { version, guard } = this._state
    this._state = { type: "handshaked", version, guard }

    const stateEvent = new MessageEvent("handshake", {})
    if (!await this.dispatchEvent(stateEvent)) return

    console.debug(`NETINFO`, data)
  }

  private async onCreatedFastCell(cell: NewCell) {
    const data = CreatedFastCell.uncell(cell)

    const cellEvent = new MessageEvent("CREATED_FAST", { data })
    if (!await this.dispatchEvent(cellEvent)) return

    console.debug(`CREATED_FAST`, data)
  }

  private async onDestroyCell(cell: NewCell) {
    const data = DestroyCell.uncell(cell)

    const cellEvent = new MessageEvent("DESTROY", { data })
    if (!await this.dispatchEvent(cellEvent)) return

    this.circuits.delete(data.circuit.id)

    console.debug(`DESTROY`, data)
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

    const cellEvent = new MessageEvent("RELAY_EXTENDED2", { data })
    if (!await this.dispatchEvent(cellEvent)) return

    console.debug(`RELAY_EXTENDED2`, data)
  }

  private async onRelayConnectedCell(cell: RelayCell) {
    const data = RelayConnectedCell.uncell(cell)

    const cellEvent = new MessageEvent("RELAY_CONNECTED", { data })
    if (!await this.dispatchEvent(cellEvent)) return

    console.debug(`RELAY_CONNECTED`, data)
  }

  private async onRelayDataCell(cell: RelayCell) {
    const data = RelayDataCell.uncell(cell)

    const cellEvent = new MessageEvent("RELAY_DATA", { data })
    if (!await this.dispatchEvent(cellEvent)) return

    console.debug(`RELAY_DATA`, data)
  }

  private async onRelayEndCell(cell: RelayCell) {
    const data = RelayEndCell.uncell(cell)

    const cellEvent = new MessageEvent("RELAY_END", { data })
    if (!await this.dispatchEvent(cellEvent)) return

    console.debug(`RELAY_END`, data)
  }

  private async onRelayDropCell(cell: RelayCell) {
    const data = RelayDropCell.uncell(cell)

    const cellEvent = new MessageEvent("RELAY_DROP", { data })
    if (!await this.dispatchEvent(cellEvent)) return

    console.debug(`RELAY_DROP`, data)
  }

  private async onRelayTruncatedCell(cell: RelayCell) {
    const data = RelayTruncatedCell.uncell(cell)

    const cellEvent = new MessageEvent("RELAY_TRUNCATED", { data })
    if (!await this.dispatchEvent(cellEvent)) return

    data.circuit.targets.pop()

    console.debug(`RELAY_TRUNCATED`, data)
  }

  private async waitHandshake(signal?: AbortSignal) {
    const future = new Future<Event>()

    try {
      signal?.addEventListener("abort", future.err, { passive: true })
      this.read.addEventListener("close", future.err, { passive: true })
      this.addEventListener("error", future.err, { passive: true })
      this.addEventListener("handshake", future.ok, { passive: true })

      await future.promise
    } finally {
      signal?.removeEventListener("abort", future.err)
      this.read.removeEventListener("close", future.err)
      this.removeEventListener("error", future.err)
      this.removeEventListener("handshake", future.ok)
    }
  }

  async handshake() {
    await this.init()

    await this._tls.handshake()

    const handshake = this.waitHandshake()

    const version = new VersionsCell(undefined, [5])
    this.output.enqueue(version.pack())

    await handshake
  }

  private async waitCreatedFast(circuit: Circuit, signal?: AbortSignal) {
    const future = new Future<CreatedFastCell>()

    const onCreatedFastCell = (event: Event) => {
      const msgEvent = event as MessageEvent<CreatedFastCell>
      if (msgEvent.data.circuit !== circuit) return

      future.ok(msgEvent.data)
    }

    try {
      signal?.addEventListener("abort", future.err, { passive: true })
      this.read.addEventListener("close", future.err, { passive: true })
      this.addEventListener("error", future.err, { passive: true })
      this.addEventListener("CREATED_FAST", onCreatedFastCell, { passive: true })

      return await future.promise
    } finally {
      signal?.removeEventListener("abort", future.err)
      this.read.removeEventListener("close", future.err)
      this.removeEventListener("error", future.err)
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
    if (this._state.type !== "handshaked")
      throw new Error(`Can't create a circuit yet`)

    const circuit = await this.createCircuitAtomic()
    const material = Bytes.random(20)

    const pcreated = this.waitCreatedFast(circuit, signal)
    const create_fast = new CreateFastCell(circuit, material)
    this.output.enqueue(create_fast.pack())

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

    const target = new Target(this._state.guard.idh, circuit, forwardDigest, backwardDigest, forwardKey, backwardKey)

    circuit.targets.push(target)

    return circuit
  }
}