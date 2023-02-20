import { Berith } from "@hazae41/berith";
import { Cursor } from "@hazae41/binary";
import { Bitset } from "@hazae41/bitset";
import { Bytes } from "@hazae41/bytes";
import { TlsStream } from "@hazae41/cadenas";
import { Foras } from "@hazae41/foras";
import { Morax } from "@hazae41/morax";
import { Paimon } from "@hazae41/paimon";
import { Aes128Ctr128BEKey, Zepar } from "@hazae41/zepar";
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

  readonly #reader: TransformStream<Uint8Array>
  readonly #writer: TransformStream<Uint8Array>

  #input?: TransformStreamDefaultController<Uint8Array>
  #output?: TransformStreamDefaultController<Uint8Array>

  readonly authorities = new Array<Authority>()
  readonly circuits = new Map<number, Circuit>()

  readonly #tls: TlsStream

  readonly #buffer = Cursor.allocUnsafe(65535)

  #state: TorState = { type: "none" }

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

    this.#tls = tls

    this.#reader = new TransformStream<Uint8Array>({
      start: this.#onReadStart.bind(this),
      transform: this.#onRead.bind(this),
    })

    this.#writer = new TransformStream<Uint8Array>({
      start: this.#onWriteStart.bind(this),
    })

    tls.readable
      .pipeTo(this.#reader.writable, { signal })
      .then(this.#onReadClose.bind(this))
      .catch(this.#onReadError.bind(this))

    this.#writer.readable
      .pipeTo(tls.writable, { signal })
      .then(this.#onWriteClose.bind(this))
      .catch(this.#onWriteError.bind(this))

    this.#reader.readable
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

  get input() {
    return this.#input!
  }

  get output() {
    return this.#output!
  }

  async #wait(type: string, signal?: AbortSignal) {
    const future = new Future<Event, Error>()
    const onEvent = (event: Event) => future.ok(event)
    return await this.#waitFor(type, { future, onEvent, signal })
  }

  async #waitFor<T>(type: string, params: {
    future: Future<T, Error>,
    onEvent: (event: Event) => void,
    signal?: AbortSignal
  }) {
    const { future, onEvent, signal } = params

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
      this.addEventListener(type, onEvent, { passive: true })

      return await future.promise
    } finally {
      signal?.removeEventListener("abort", onAbort)
      this.read.removeEventListener("close", onClose)
      this.read.removeEventListener("error", onError)
      this.removeEventListener(type, onEvent)
    }
  }

  async #onReadClose() {
    console.debug(`${this.#class.name}.onReadClose`)

    const closeEvent = new CloseEvent("close", {})
    if (!await this.read.dispatchEvent(closeEvent)) return
  }

  async #onWriteClose() {
    console.debug(`${this.#class.name}.onWriteClose`)

    const closeEvent = new CloseEvent("close", {})
    if (!await this.write.dispatchEvent(closeEvent)) return
  }

  async #onReadError(error?: unknown) {
    console.debug(`${this.#class.name}.onReadError`, error)

    try { this.output!.error(error) } catch (e: unknown) { }

    const errorEvent = new ErrorEvent("error", { error })
    if (!await this.read.dispatchEvent(errorEvent)) return
  }

  async #onWriteError(error?: unknown) {
    console.debug(`${this.#class.name}.onWriteError`, error)

    try { this.input!.error(error) } catch (e: unknown) { }

    const errorEvent = new ErrorEvent("error", { error })
    if (!await this.write.dispatchEvent(errorEvent)) return
  }

  async #onReadStart(controller: TransformStreamDefaultController<Uint8Array>) {
    this.#input = controller
  }

  async #onWriteStart(controller: TransformStreamDefaultController<Uint8Array>) {
    this.#output = controller

    await this.#init()

    const version = new VersionsCell(undefined, [5])
    this.#output!.enqueue(version.pack())

    await this.#wait("handshake")
  }

  async #onRead(chunk: Uint8Array) {
    // console.debug("<-", chunk)

    if (this.#buffer.offset)
      await this.#onReadBuffered(chunk)
    else
      await this.#onReadDirect(chunk)
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
      try {
        const rawCell = this.#state.type === "none"
          ? OldCell.tryRead(cursor)
          : NewCell.tryRead(cursor)

        if (!rawCell) {
          this.#buffer.write(cursor.after)
          break
        }

        const cell = rawCell.type === "old"
          ? OldCell.unpack(this, rawCell)
          : NewCell.unpack(this, rawCell)

        await this.#onCell(cell)
      } catch (e: unknown) {
        console.error(e)
      }
    }
  }

  async #onCell(cell: Cell) {
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

  async #onNoneStateCell(cell: Cell) {
    if (this.#state.type !== "none")
      throw new Error(`State is not none`)
    if (cell instanceof NewCell)
      throw new Error(`Can't uncell pre-version cell from new cell`)

    if (cell.command === VersionsCell.command)
      return await this.#onVersionsCell(cell)

    console.debug(`Unknown pre-version cell ${cell.command}`)
  }

  async #onVersionedStateCell(cell: NewCell) {
    if (this.#state.type !== "versioned")
      throw new Error(`State is not versioned`)

    if (cell.command === CertsCell.command)
      return await this.#onCertsCell(cell)

    console.debug(`Unknown versioned-state cell ${cell.command}`)
  }

  async #onHandshakingStateCell(cell: NewCell) {
    if (this.#state.type !== "handshaking")
      throw new Error(`State is not handshaking`)

    if (cell.command === AuthChallengeCell.command)
      return await this.#onAuthChallengeCell(cell)
    if (cell.command === NetinfoCell.command)
      return await this.#onNetinfoCell(cell)

    console.debug(`Unknown handshaking-state cell ${cell.command}`)
  }

  async #onHandshakedStateCell(cell: NewCell) {
    if (cell.command === CreatedFastCell.command)
      return await this.#onCreatedFastCell(cell)
    if (cell.command === DestroyCell.command)
      return await this.#onDestroyCell(cell)
    if (cell.command === RelayCell.command)
      return await this.#onRelayCell(cell)

    console.debug(`Unknown handshaked-state cell ${cell.command}`)
  }

  async #onVersionsCell(cell: OldCell) {
    if (this.#state.type !== "none")
      throw new Error(`State is not none`)

    const data = VersionsCell.uncell(cell)

    console.debug(`VERSIONS`, data)

    const cellEvent = new MessageEvent("VERSIONS", { data })
    if (!await this.dispatchEvent(cellEvent)) return

    if (!data.versions.includes(5))
      throw new Error(`Incompatible versions`)

    this.#state = { type: "versioned", version: 5 }

    const stateEvent = new MessageEvent("versioned", { data: 5 })
    if (!await this.dispatchEvent(stateEvent)) return
  }

  async #onCertsCell(cell: NewCell) {
    if (this.#state.type !== "versioned")
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

    const { version } = this.#state
    this.#state = { type: "handshaking", version, guard }

    const stateEvent = new MessageEvent("handshaking", {})
    if (!await this.dispatchEvent(stateEvent)) return
  }

  async #onAuthChallengeCell(cell: NewCell) {
    if (this.#state.type !== "handshaking")
      throw new Error(`State is not handshaking`)

    const data = AuthChallengeCell.uncell(cell)

    console.debug(`AUTH_CHALLENGE`, data)

    const cellEvent = new MessageEvent("AUTH_CHALLENGE", { data })
    if (!await this.dispatchEvent(cellEvent)) return
  }

  async #onNetinfoCell(cell: NewCell) {
    if (this.#state.type !== "handshaking")
      throw new Error(`State is not handshaking`)

    const data = NetinfoCell.uncell(cell)

    console.debug(`NETINFO`, data)

    const cellEvent = new MessageEvent("NETINFO", { data })
    if (!await this.dispatchEvent(cellEvent)) return

    const address = new TypedAddress(4, new Uint8Array([127, 0, 0, 1]))
    const netinfo = new NetinfoCell(undefined, 0, address, [])
    this.#output!.enqueue(netinfo.pack())

    const pversion = PaddingNegociateCell.versions.ZERO
    const pcommand = PaddingNegociateCell.commands.STOP
    const padding = new PaddingNegociateCell(undefined, pversion, pcommand, 0, 0)
    this.#output!.enqueue(padding.pack())

    const { version, guard } = this.#state
    this.#state = { type: "handshaked", version, guard }

    const stateEvent = new MessageEvent("handshake", {})
    if (!await this.dispatchEvent(stateEvent)) return
  }

  async #onCreatedFastCell(cell: NewCell) {
    const data = CreatedFastCell.uncell(cell)

    console.debug(`CREATED_FAST`, data)

    const cellEvent = new MessageEvent("CREATED_FAST", { data })
    if (!await this.dispatchEvent(cellEvent)) return
  }

  async #onDestroyCell(cell: NewCell) {
    const data = DestroyCell.uncell(cell)

    console.debug(`DESTROY`, data)

    const cellEvent = new MessageEvent("DESTROY", { data })
    if (!await this.dispatchEvent(cellEvent)) return

    this.circuits.delete(data.circuit.id)
  }

  async #onRelayCell(parent: NewCell) {
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

  async #onRelayExtended2Cell(cell: RelayCell) {
    const data = RelayExtended2Cell.uncell(cell)

    console.debug(`RELAY_EXTENDED2`, data)

    const cellEvent = new MessageEvent("RELAY_EXTENDED2", { data })
    if (!await this.dispatchEvent(cellEvent)) return
  }

  async #onRelayConnectedCell(cell: RelayCell) {
    const data = RelayConnectedCell.uncell(cell)

    console.debug(`RELAY_CONNECTED`, data)

    const cellEvent = new MessageEvent("RELAY_CONNECTED", { data })
    if (!await this.dispatchEvent(cellEvent)) return
  }

  async #onRelayDataCell(cell: RelayCell) {
    const data = RelayDataCell.uncell(cell)

    console.debug(`RELAY_DATA`, data)

    const cellEvent = new MessageEvent("RELAY_DATA", { data })
    if (!await this.dispatchEvent(cellEvent)) return
  }

  async #onRelayEndCell(cell: RelayCell) {
    const data = RelayEndCell.uncell(cell)

    console.debug(`RELAY_END`, data)

    const cellEvent = new MessageEvent("RELAY_END", { data })
    if (!await this.dispatchEvent(cellEvent)) return
  }

  async #onRelayDropCell(cell: RelayCell) {
    const data = RelayDropCell.uncell(cell)

    console.debug(`RELAY_DROP`, data)

    const cellEvent = new MessageEvent("RELAY_DROP", { data })
    if (!await this.dispatchEvent(cellEvent)) return
  }

  async #onRelayTruncatedCell(cell: RelayCell) {
    const data = RelayTruncatedCell.uncell(cell)

    console.debug(`RELAY_TRUNCATED`, data)

    const cellEvent = new MessageEvent("RELAY_TRUNCATED", { data })
    if (!await this.dispatchEvent(cellEvent)) return

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

        const circuit = new Circuit(this, circuitId)
        this.circuits.set(circuitId, circuit)

        return circuit
      }
    })
  }

  async #waitCreatedFast(circuit: Circuit, signal?: AbortSignal) {
    const future = new Future<CreatedFastCell, Error>()

    const onEvent = (event: Event) => {
      const msgEvent = event as MessageEvent<CreatedFastCell>
      if (msgEvent.data.circuit !== circuit) return
      future.ok(msgEvent.data)
    }

    return await this.#waitFor("CREATED_FAST", { future, onEvent, signal })
  }

  async tryCreateAndExtend(params: LoopParams = {}) {
    const { signal, timeout = 5000, delay = 1000 } = params

    while (true) {
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
  }

  async tryCreate(params: LoopParams = {}) {
    const { signal, timeout = 5000, delay = 1000 } = params

    while (true) {
      try {
        const signal = AbortSignal.timeout(timeout)
        return await this.create(signal)
      } catch (e: unknown) {
        if (signal?.aborted) throw e

        console.warn("Create failed", e)
        await new Promise(ok => setTimeout(ok, delay))
      }
    }
  }

  async create(signal?: AbortSignal) {
    if (this.#state.type !== "handshaked")
      throw new Error(`Can't create a circuit yet`)

    const circuit = await this.#createCircuitAtomic()
    const material = Bytes.random(20)

    const create_fast = new CreateFastCell(circuit, material)
    this.#output!.enqueue(create_fast.pack())

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

    return circuit
  }
}