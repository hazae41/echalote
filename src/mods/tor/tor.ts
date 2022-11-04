import { Berith } from "@hazae41/berith";
import { Foras } from "@hazae41/foras";
import { Morax, Sha1Hasher } from "@hazae41/morax";
import { Paimon } from "@hazae41/paimon";
import { Aes128Ctr128BEKey, Zepar } from "@hazae41/zepar";
import { Binary } from "libs/binary.js";
import { Bitmask } from "libs/bits.js";
import { Events } from "libs/events.js";
import { Future } from "libs/future.js";
import { Tls } from "mods/tls/tls.js";
import { kdftor } from "mods/tor/algos/kdftor.js";
import { TypedAddress } from "mods/tor/binary/address.js";
import { Cell, NewCell, OldCell } from "mods/tor/binary/cells/cell.js";
import { AuthChallengeCell } from "mods/tor/binary/cells/direct/auth_challenge.js";
import { Certs, CertsCell } from "mods/tor/binary/cells/direct/certs.js";
import { CreatedFastCell } from "mods/tor/binary/cells/direct/created_fast.js";
import { CreateFastCell } from "mods/tor/binary/cells/direct/create_fast.js";
import { DestroyCell } from "mods/tor/binary/cells/direct/destroy.js";
import { NetinfoCell } from "mods/tor/binary/cells/direct/netinfo.js";
import { PaddingCell } from "mods/tor/binary/cells/direct/padding.js";
import { PaddingNegociateCell } from "mods/tor/binary/cells/direct/padding_negotiate.js";
import { RelayCell } from "mods/tor/binary/cells/direct/relay.js";
import { VersionsCell } from "mods/tor/binary/cells/direct/versions.js";
import { VariablePaddingCell } from "mods/tor/binary/cells/direct/vpadding.js";
import { RelayConnectedCell } from "mods/tor/binary/cells/relayed/relay_connected.js";
import { RelayDataCell } from "mods/tor/binary/cells/relayed/relay_data.js";
import { RelayDropCell } from "mods/tor/binary/cells/relayed/relay_drop.js";
import { RelayEndCell } from "mods/tor/binary/cells/relayed/relay_end.js";
import { RelayExtended2Cell } from "mods/tor/binary/cells/relayed/relay_extended2.js";
import { RelayTruncatedCell } from "mods/tor/binary/cells/relayed/relay_truncated.js";
import { Circuit } from "mods/tor/circuit.js";
import { Directories } from "mods/tor/consensus/directories.js";
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
  readonly idh: Buffer
  readonly certs: Certs
}

export interface Fallback {
  id: string,
  eid: string,
  exit: boolean,
  onion: number[]
  hosts: string[]
}

export class Tor extends EventTarget {
  readonly class = Tor

  private _state: TorState = { type: "none" }

  readonly directories = new Directories(this)
  readonly circuits = new Map<number, Circuit>()

  readonly streams = new TransformStream<Buffer, Buffer>()

  private buffer = Buffer.allocUnsafe(4 * 4096)
  private wbuffer = new Binary(this.buffer)
  private rbuffer = new Binary(this.buffer)

  fallbacks = {
    exits: new Array<Fallback>(),
    middles: new Array<Fallback>()
  }

  constructor(
    readonly tls: Tls
  ) {
    super()

    const onMessage = this.onMessage.bind(this)
    this.tls.addEventListener("message", onMessage, { passive: true })

    this.directories.loadAuthorities()

    this.tryRead().catch(console.error)
  }

  get state() {
    return this._state
  }

  async init() {
    await Paimon.initBundledOnce()
    await Berith.initBundledOnce()
    await Zepar.initBundledOnce()
    await Morax.initBundledOnce()
    await Foras.initBundledOnce()
  }

  send(...arrays: Buffer[]) {
    let length = 0

    for (let i = 0; i < arrays.length; i++)
      length += arrays[i].length
    const packet = Binary.allocUnsafe(length)

    for (const array of arrays)
      packet.write(array)
    this.tls.send(packet.buffer)
  }

  private async onMessage(event: Event) {
    const message = event as MessageEvent<Buffer>

    const writer = this.streams.writable.getWriter()
    writer.write(message.data)
    writer.releaseLock()
  }

  private async tryRead() {
    const reader = this.streams.readable.getReader()

    try {
      await this.read(reader)
    } finally {
      reader.releaseLock()
    }
  }

  private async read(reader: ReadableStreamReader<Buffer>) {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      this.wbuffer.write(value)
      await this.onRead()
    }
  }

  private async onRead() {
    this.rbuffer.buffer = this.buffer.subarray(0, this.wbuffer.offset)

    while (this.rbuffer.remaining) {
      try {
        const rawCell = this._state.type === "none"
          ? OldCell.tryRead(this.rbuffer)
          : NewCell.tryRead(this.rbuffer)

        if (!rawCell) break

        const cell = rawCell.type === "old"
          ? OldCell.unpack(this, rawCell)
          : NewCell.unpack(this, rawCell)

        await this.onCell(cell)
      } catch (e: unknown) {
        console.error(e)
      }
    }

    if (!this.rbuffer.offset)
      return

    if (this.rbuffer.offset === this.wbuffer.offset) {
      this.rbuffer.offset = 0
      this.wbuffer.offset = 0
      return
    }

    if (this.rbuffer.remaining && this.wbuffer.remaining < 4096) {
      console.debug(`Reallocating buffer`)

      const remaining = this.buffer.subarray(this.rbuffer.offset, this.wbuffer.offset)

      this.rbuffer.offset = 0
      this.wbuffer.offset = 0

      this.buffer = Buffer.allocUnsafe(4 * 4096)
      this.rbuffer.buffer = this.buffer
      this.wbuffer.buffer = this.buffer

      this.wbuffer.write(remaining)
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

    const event = new MessageEvent("VERSIONS", { data })
    if (!this.dispatchEvent(event)) return

    if (!data.versions.includes(5))
      throw new Error(`Incompatible versions`)

    this._state = { type: "versioned", version: 5 }

    const event2 = new MessageEvent("versioned", { data: 5 })
    if (!this.dispatchEvent(event2)) return

    console.debug(`VERSIONS`, data)
  }

  private async onCertsCell(cell: NewCell) {
    if (this._state.type !== "versioned")
      throw new Error(`State is not versioned`)

    const data = CertsCell.uncell(cell)

    const event = new MessageEvent("CERTS", { data })
    if (!this.dispatchEvent(event)) return

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

    const event2 = new MessageEvent("handshaking", {})
    if (!this.dispatchEvent(event2)) return

    console.debug(`CERTS`, data)
  }

  private async onAuthChallengeCell(cell: NewCell) {
    if (this._state.type !== "handshaking")
      throw new Error(`State is not handshaking`)

    const data = AuthChallengeCell.uncell(cell)

    const event = new MessageEvent("AUTH_CHALLENGE", { data })
    if (!this.dispatchEvent(event)) return

    console.debug(`AUTH_CHALLENGE`, data)
  }

  private async onNetinfoCell(cell: NewCell) {
    if (this._state.type !== "handshaking")
      throw new Error(`State is not handshaking`)

    const data = NetinfoCell.uncell(cell)

    const event = new MessageEvent("NETINFO", { data })
    if (!this.dispatchEvent(event)) return

    const address = new TypedAddress(4, Buffer.from([127, 0, 0, 1]))
    const netinfo = new NetinfoCell(undefined, 0, address, [])
    const pversion = PaddingNegociateCell.versions.ZERO
    const pcommand = PaddingNegociateCell.commands.STOP
    const padding = new PaddingNegociateCell(undefined, pversion, pcommand, 0, 0)
    this.send(netinfo.pack(), padding.pack())

    const { version, guard } = this._state
    this._state = { type: "handshaked", version, guard }

    const event2 = new MessageEvent("handshake", {})
    if (!this.dispatchEvent(event2)) return

    console.debug(`NETINFO`, data)
  }

  private async onCreatedFastCell(cell: NewCell) {
    const data = CreatedFastCell.uncell(cell)

    const event = new MessageEvent("CREATED_FAST", { data })
    if (!this.dispatchEvent(event)) return

    console.debug(`CREATED_FAST`, data)
  }

  private async onDestroyCell(cell: NewCell) {
    const data = DestroyCell.uncell(cell)

    const event = new MessageEvent("DESTROY", { data })
    if (!this.dispatchEvent(event)) return

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

    const event = new MessageEvent("RELAY_EXTENDED2", { data })
    if (!this.dispatchEvent(event)) return

    console.debug(`RELAY_EXTENDED2`, data)
  }

  private async onRelayConnectedCell(cell: RelayCell) {
    const data = RelayConnectedCell.uncell(cell)

    const event = new MessageEvent("RELAY_CONNECTED", { data })
    if (!this.dispatchEvent(event)) return

    console.debug(`RELAY_CONNECTED`, data)
  }

  private async onRelayDataCell(cell: RelayCell) {
    const data = RelayDataCell.uncell(cell)

    const event = new MessageEvent("RELAY_DATA", { data })
    if (!this.dispatchEvent(event)) return

    console.debug(`RELAY_DATA`, data)
  }

  private async onRelayEndCell(cell: RelayCell) {
    const data = RelayEndCell.uncell(cell)

    const event = new MessageEvent("RELAY_END", { data })
    if (!this.dispatchEvent(event)) return

    console.debug(`RELAY_END`, data)
  }

  private async onRelayDropCell(cell: RelayCell) {
    const data = RelayDropCell.uncell(cell)

    const event = new MessageEvent("RELAY_DROP", { data })
    if (!this.dispatchEvent(event)) return

    console.debug(`RELAY_DROP`, data)
  }

  private async onRelayTruncatedCell(cell: RelayCell) {
    const data = RelayTruncatedCell.uncell(cell)

    const event = new MessageEvent("RELAY_TRUNCATED", { data })
    if (!this.dispatchEvent(event)) return

    data.circuit.targets.pop()

    console.debug(`RELAY_TRUNCATED`, data)
  }

  private async waitHandshake() {
    const future = new Future<Event, Event>()

    try {
      this.tls.addEventListener("close", future.err, { passive: true })
      this.tls.addEventListener("error", future.err, { passive: true })
      this.addEventListener("handshake", future.ok, { passive: true })
      await future.promise
    } catch (e: unknown) {
      throw Events.error(e)
    } finally {
      this.tls.removeEventListener("error", future.err)
      this.tls.removeEventListener("close", future.err)
      this.removeEventListener("handshake", future.ok)
    }
  }

  async handshake() {
    await this.tls.open()

    const handshake = this.waitHandshake()
    this.send(new VersionsCell(undefined, [5]).pack())
    await handshake
  }

  private async waitCreatedFast(circuit: Circuit) {
    const future = new Future<CreatedFastCell, Event>()

    const onCreatedFastCell = (event: Event) => {
      const message = event as MessageEvent<CreatedFastCell>
      if (message.data.circuit === circuit) future.ok(message.data)
    }

    try {
      this.tls.addEventListener("close", future.err, { passive: true })
      this.tls.addEventListener("error", future.err, { passive: true })
      this.addEventListener("CREATED_FAST", onCreatedFastCell, { passive: true })
      return await future.promise
    } catch (e: unknown) {
      throw Events.error(e)
    } finally {
      this.tls.removeEventListener("error", future.err)
      this.tls.removeEventListener("close", future.err)
      this.removeEventListener("CREATED_FAST", onCreatedFastCell)
    }
  }

  async create() {
    if (this._state.type !== "handshaked")
      throw new Error(`Can't create a circuit yet`)

    const circuitId = new Bitmask(Date.now())
      .set(31, true)
      .export()

    const circuit = new Circuit(this, circuitId)
    this.circuits.set(circuitId, circuit)

    const material = Buffer.allocUnsafe(20)
    crypto.getRandomValues(material)

    const pcreated = this.waitCreatedFast(circuit)
    this.send(new CreateFastCell(circuit, material).pack())
    const created = await pcreated

    const k0 = Buffer.concat([material, created.material])
    const result = await kdftor(k0)

    if (!result.keyHash.equals(created.derivative))
      throw new Error(`Invalid KDF-TOR key hash`)

    const forwardDigest = new Sha1Hasher()
    const backwardDigest = new Sha1Hasher()

    forwardDigest.update(result.forwardDigest)
    backwardDigest.update(result.backwardDigest)

    const forwardKey = new Aes128Ctr128BEKey(result.forwardKey, Buffer.alloc(16))
    const backwardKey = new Aes128Ctr128BEKey(result.backwardKey, Buffer.alloc(16))

    const target = new Target(this._state.guard.idh, circuit, forwardDigest, backwardDigest, forwardKey, backwardKey)

    circuit.targets.push(target)

    return circuit
  }
}