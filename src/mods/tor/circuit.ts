import { Base64 } from "@hazae41/base64";
import { Opaque } from "@hazae41/binary";
import { Bitset } from "@hazae41/bitset";
import { Bytes } from "@hazae41/bytes";
import { fetch } from "@hazae41/fleche";
import { Future } from "@hazae41/future";
import { None, Option } from "@hazae41/option";
import { CloseEvents, ClosedError, ErrorEvents, ErroredError, Plume, SuperEventTarget } from "@hazae41/plume";
import { Result } from "@hazae41/result";
import { Sha1 } from "@hazae41/sha1";
import { X25519 } from "@hazae41/x25519";
import { Aes128Ctr128BEKey, Zepar } from "@hazae41/zepar";
import { AbortSignals } from "libs/signals/signals.js";
import { Console } from "mods/console/index.js";
import { Ntor } from "mods/tor/algorithms/ntor/index.js";
import { DestroyCell } from "mods/tor/binary/cells/direct/destroy/cell.js";
import { RelayBeginCell } from "mods/tor/binary/cells/relayed/relay_begin/cell.js";
import { RelayDataCell } from "mods/tor/binary/cells/relayed/relay_data/cell.js";
import { RelayEndCell } from "mods/tor/binary/cells/relayed/relay_end/cell.js";
import { RelayExtend2Cell } from "mods/tor/binary/cells/relayed/relay_extend2/cell.js";
import { RelayExtend2Link, RelayExtend2LinkIPv4, RelayExtend2LinkIPv6, RelayExtend2LinkLegacyID, RelayExtend2LinkModernID } from "mods/tor/binary/cells/relayed/relay_extend2/link.js";
import { RelayExtended2Cell } from "mods/tor/binary/cells/relayed/relay_extended2/cell.js";
import { RelayTruncateCell } from "mods/tor/binary/cells/relayed/relay_truncate/cell.js";
import { RelayTruncatedCell } from "mods/tor/binary/cells/relayed/relay_truncated/cell.js";
import { SecretTorStreamDuplex, TorStreamDuplex } from "mods/tor/stream.js";
import { Target } from "mods/tor/target.js";
import { SecretTorClientDuplex } from "mods/tor/tor.js";
import { InvalidNtorAuthError, NtorResult } from "./algorithms/ntor/ntor.js";
import { Cell } from "./binary/cells/cell.js";
import { RelayCell } from "./binary/cells/direct/relay/cell.js";
import { RelayEarlyCell } from "./binary/cells/direct/relay_early/cell.js";
import { RelayBeginDirCell } from "./binary/cells/relayed/relay_begin_dir/cell.js";
import { Microdesc } from "./consensus/microdesc.js";
import { HASH_LEN } from "./constants.js";

export const IPv6 = {
  always: 3,
  preferred: 2,
  avoided: 1,
  never: 0
} as const

export interface CircuitOpenParams {
  /**
   * Wait RELAY_CONNECTED
   */
  readonly wait?: boolean

  /**
   * IPv6 preference
   */
  readonly ipv6?: keyof typeof IPv6
}

export class EmptyFallbacksError extends Error {
  readonly #class = EmptyFallbacksError
  readonly name = this.#class.name

  constructor() {
    super(`Empty fallbacks`)
  }

}

export class UnknownProtocolError extends Error {
  readonly #class = UnknownProtocolError
  readonly name = this.#class.name

  constructor(
    readonly protocol: string
  ) {
    super(`Unknown protocol "${protocol}"`)
  }

}

export class DestroyedError extends Error {
  readonly #class = DestroyedError
  readonly name = this.#class.name

  constructor(
    readonly reason: number
  ) {
    super(`Circuit destroyed`, { cause: reason })
  }

}

export class Circuit {

  readonly events = new SuperEventTarget<CloseEvents & ErrorEvents>()

  readonly #secret: SecretCircuit

  constructor(secret: SecretCircuit) {
    this.#secret = secret

    const onClose = this.#onClose.bind(this)
    this.#secret.events.on("close", onClose)

    const onError = this.#onError.bind(this)
    this.#secret.events.on("error", onError)
  }

  get id() {
    return this.#secret.id
  }

  get closed() {
    return Boolean(this.#secret.closed)
  }

  async #onClose() {
    return await this.events.emit("close", [undefined])
  }

  async #onError(reason?: unknown) {
    return await this.events.emit("error", [reason])
  }

  async extendToOrThrow(microdesc: Microdesc, signal?: AbortSignal) {
    return await this.#secret.extendToOrThrow(microdesc, signal)
  }

  async tryExtendTo(microdesc: Microdesc, signal?: AbortSignal) {
    return await this.#secret.tryExtendTo(microdesc, signal)
  }

  async openOrThrow(hostname: string, port: number, params?: CircuitOpenParams, signal?: AbortSignal) {
    return await this.#secret.openOrThrow(hostname, port, params, signal)
  }

  async tryOpen(hostname: string, port: number, params?: CircuitOpenParams) {
    return await this.#secret.tryOpen(hostname, port, params)
  }

  async openDirOrThrow(params?: CircuitOpenParams, signal?: AbortSignal) {
    return await this.#secret.openDirOrThrow(params, signal)
  }

  async unrefOrThrow(ref: Microdesc.Pre) {
    return await this.#secret.unrefOrThrow(ref)
  }

  async close() {
    return await this.#secret.close()
  }

}

export type SecretCircuitEvents = CloseEvents & ErrorEvents & {
  /**
   * Streamless
   */
  "RELAY_EXTENDED2": (cell: RelayCell.Streamless<RelayExtended2Cell<Opaque>>) => void
  "RELAY_TRUNCATED": (cell: RelayCell.Streamless<RelayTruncatedCell>) => void

  /**
   * Streamful
   */
  "RELAY_CONNECTED": (cell: RelayCell.Streamful<Opaque>) => void
  "RELAY_DATA": (cell: RelayCell.Streamful<RelayDataCell<Opaque>>) => void
  "RELAY_END": (cell: RelayCell.Streamful<RelayEndCell>) => void
}

export class SecretCircuit {
  readonly #class = SecretCircuit

  readonly events = new SuperEventTarget<SecretCircuitEvents>()

  readonly targets = new Array<Target>()
  readonly streams = new Map<number, SecretTorStreamDuplex>()

  #streamId = 1

  #closed?: { reason?: unknown }

  #onClean: () => void

  constructor(
    readonly id: number,
    readonly tor: SecretTorClientDuplex
  ) {
    const onClose = this.#onTorClose.bind(this)
    const onError = this.#onTorError.bind(this)

    const onDestroyCell = this.#onDestroyCell.bind(this)

    const onRelayExtended2Cell = this.#onRelayExtended2Cell.bind(this)
    const onRelayTruncatedCell = this.#onRelayTruncatedCell.bind(this)

    const onRelayConnectedCell = this.#onRelayConnectedCell.bind(this)
    const onRelayDataCell = this.#onRelayDataCell.bind(this)
    const onRelayEndCell = this.#onRelayEndCell.bind(this)

    this.tor.events.on("close", onClose, { passive: true })
    this.tor.events.on("error", onError, { passive: true })

    this.tor.events.on("DESTROY", onDestroyCell, { passive: true })

    this.tor.events.on("RELAY_EXTENDED2", onRelayExtended2Cell, { passive: true })
    this.tor.events.on("RELAY_TRUNCATED", onRelayTruncatedCell, { passive: true })

    this.tor.events.on("RELAY_CONNECTED", onRelayConnectedCell, { passive: true })
    this.tor.events.on("RELAY_DATA", onRelayDataCell, { passive: true })
    this.tor.events.on("RELAY_END", onRelayEndCell, { passive: true })

    this.#onClean = () => {
      for (const target of this.targets)
        target[Symbol.dispose]()

      this.tor.events.off("close", onClose)
      this.tor.events.off("error", onError)

      this.tor.events.off("DESTROY", onDestroyCell)

      this.tor.events.off("RELAY_EXTENDED2", onRelayExtended2Cell)
      this.tor.events.off("RELAY_TRUNCATED", onRelayTruncatedCell)

      this.tor.events.off("RELAY_CONNECTED", onRelayConnectedCell)
      this.tor.events.off("RELAY_DATA", onRelayDataCell)
      this.tor.events.off("RELAY_END", onRelayEndCell)

      this.#onClean = () => { }
    }

  }

  async [Symbol.asyncDispose]() {
    await this.close()
  }

  get closed() {
    return this.#closed
  }

  #onCloseOrError(reason?: unknown) {
    if (this.#closed)
      return
    this.#closed = { reason }
    this.#onClean()
  }

  async close(reason: number = DestroyCell.reasons.NONE) {
    const error = new DestroyedError(reason)

    // TODO: send destroy cell

    this.#onCloseOrError(error)

    if (reason === DestroyCell.reasons.NONE)
      await this.events.emit("close", [error])
    else
      await this.events.emit("error", [error])
  }

  async #onTorClose() {
    Console.debug(`${this.#class.name}.onTorClose`)

    this.#onCloseOrError()

    await this.events.emit("close", [undefined])

    return new None()
  }

  async #onTorError(reason?: unknown) {
    Console.debug(`${this.#class.name}.onReadError`, { reason })

    this.#onCloseOrError(reason)

    await this.events.emit("error", [reason])

    return new None()
  }

  async #onDestroyCell(cell: Cell.Circuitful<DestroyCell>) {
    if (cell.circuit !== this)
      return new None()

    Console.debug(`${this.#class.name}.onDestroyCell`, cell)

    const error = new DestroyedError(cell.fragment.reason)

    this.#onCloseOrError(error)

    if (cell.fragment.reason === DestroyCell.reasons.NONE)
      await this.events.emit("close", [error])
    else
      await this.events.emit("error", [error])

    return new None()
  }

  async #onRelayExtended2Cell(cell: RelayCell.Streamless<RelayExtended2Cell<Opaque>>) {
    if (cell.circuit !== this)
      return new None()

    Console.debug(`${this.#class.name}.onRelayExtended2Cell`, cell)

    await this.events.emit("RELAY_EXTENDED2", [cell])

    return new None()
  }

  async #onRelayTruncatedCell(cell: RelayCell.Streamless<RelayTruncatedCell>) {
    if (cell.circuit !== this)
      return new None()

    Console.debug(`${this.#class.name}.onRelayTruncatedCell`, cell)

    const error = new DestroyedError(cell.fragment.reason)

    this.#onCloseOrError(error)

    if (cell.fragment.reason === RelayTruncateCell.reasons.NONE)
      await this.events.emit("close", [error])
    else
      await this.events.emit("error", [error])

    await this.events.emit("RELAY_TRUNCATED", [cell])

    return new None()
  }

  async #onRelayConnectedCell(cell: RelayCell.Streamful<Opaque>) {
    if (cell.circuit !== this)
      return new None()

    Console.debug(`${this.#class.name}.onRelayConnectedCell`, cell)

    await this.events.emit("RELAY_CONNECTED", [cell])

    return new None()
  }

  async #onRelayDataCell(cell: RelayCell.Streamful<RelayDataCell<Opaque>>) {
    if (cell.circuit !== this)
      return new None()

    Console.debug(`${this.#class.name}.onRelayDataCell`, cell)

    await this.events.emit("RELAY_DATA", [cell])

    return new None()
  }

  async #onRelayEndCell(cell: RelayCell.Streamful<RelayEndCell>) {
    if (cell.circuit !== this)
      return new None()

    Console.debug(`${this.#class.name}.onRelayEndCell`, cell)

    this.streams.delete(cell.stream.id)

    await this.events.emit("RELAY_END", [cell])

    return new None()
  }

  async extendToOrThrow(microdesc: Microdesc, signal = AbortSignals.never()) {
    if (this.closed?.reason != null)
      throw ErroredError.from(this.closed.reason)
    if (this.closed != null)
      throw ClosedError.from(this.closed.reason)

    const relayid_rsa_x = Base64.get().decodeUnpaddedOrThrow(microdesc.identity).copyAndDispose()
    const relayid_rsa = Bytes.castOrThrow(relayid_rsa_x, HASH_LEN)

    const ntor_key_x = Base64.get().decodeUnpaddedOrThrow(microdesc.ntorOnionKey).copyAndDispose()
    const ntor_key = Bytes.castOrThrow(ntor_key_x, 32)

    const relayid_ed = Option.mapSync(microdesc.idEd25519, Base64.get().decodeUnpaddedOrThrow)?.copyAndDispose()

    const links = new Array<RelayExtend2Link>()

    links.push(new RelayExtend2LinkIPv4(microdesc.hostname, Number(microdesc.orport)))

    if (microdesc.ipv6 != null)
      links.push(RelayExtend2LinkIPv6.from(microdesc.ipv6))

    links.push(new RelayExtend2LinkLegacyID(relayid_rsa))

    if (relayid_ed != null)
      links.push(new RelayExtend2LinkModernID(relayid_ed))

    using wasm_secret_x = await X25519.get().PrivateKey.tryRandom().then(r => r.unwrap())
    using wasm_public_x = wasm_secret_x.tryGetPublicKey().unwrap()

    const unsized_public_x_bytes = await wasm_public_x.tryExport().then(r => r.unwrap().copyAndDispose())

    const public_x = Bytes.castOrThrow(unsized_public_x_bytes, 32)
    const public_b = ntor_key

    const ntor_request = new Ntor.NtorRequest(public_x, relayid_rsa, public_b)
    const relay_extend2 = new RelayExtend2Cell(RelayExtend2Cell.types.NTOR, links, ntor_request)
    this.tor.output.enqueue(RelayEarlyCell.Streamless.from(this, undefined, relay_extend2).cellOrThrow())

    const msg_extended2 = await Plume.waitOrCloseOrErrorOrSignal(this.events, "RELAY_EXTENDED2", (future: Future<RelayCell.Streamless<RelayExtended2Cell<Opaque>>>, e) => {
      future.resolve(e)
      return new None()
    }, signal)

    const response = msg_extended2.fragment.fragment.readIntoOrThrow(Ntor.NtorResponse)

    const { public_y } = response

    using wasm_public_y = await X25519.get().PublicKey.tryImport(public_y).then(r => r.unwrap())
    using wasm_public_b = await X25519.get().PublicKey.tryImport(public_b).then(r => r.unwrap())

    using wasm_shared_xy = await wasm_secret_x.tryCompute(wasm_public_y).then(r => r.unwrap())
    using wasm_shared_xb = await wasm_secret_x.tryCompute(wasm_public_b).then(r => r.unwrap())

    const unsized_shared_xy_bytes = wasm_shared_xy.tryExport().unwrap().copyAndDispose()
    const unsized_shared_xb_bytes = wasm_shared_xb.tryExport().unwrap().copyAndDispose()

    const shared_xy = Bytes.castOrThrow(unsized_shared_xy_bytes, 32)
    const shared_xb = Bytes.castOrThrow(unsized_shared_xb_bytes, 32)

    const result = await NtorResult.finalizeOrThrow(shared_xy, shared_xb, relayid_rsa, public_b, public_x, public_y)

    if (!Bytes.equals(response.auth, result.auth))
      throw new InvalidNtorAuthError()

    const forward_digest = Sha1.get().Hasher.createOrThrow()
    const backward_digest = Sha1.get().Hasher.createOrThrow()

    forward_digest.updateOrThrow(result.forwardDigest)
    backward_digest.updateOrThrow(result.backwardDigest)

    using forwardKeyMemory = new Zepar.Memory(result.forwardKey)
    using forwardIvMemory = new Zepar.Memory(new Uint8Array(16))

    using backwardKeyMemory = new Zepar.Memory(result.backwardKey)
    using backwardIvMemory = new Zepar.Memory(new Uint8Array(16))

    const forwardKey = new Aes128Ctr128BEKey(forwardKeyMemory, forwardIvMemory)
    const backwardKey = new Aes128Ctr128BEKey(backwardKeyMemory, backwardIvMemory)

    const target = new Target(relayid_rsa, this, forward_digest, backward_digest, forwardKey, backwardKey)

    this.targets.push(target)
  }

  async tryExtendTo(microdesc: Microdesc, signal?: AbortSignal): Promise<Result<void, Error>> {
    return await Result.runAndWrap(async () => {
      return await this.extendToOrThrow(microdesc, signal)
    }).then(r => r.mapErrSync(cause => new Error(`Could not extend`, { cause })))
  }

  async truncateOrThrow(reason = RelayTruncateCell.reasons.NONE, signal = AbortSignals.never()) {
    const relay_truncate = new RelayTruncateCell(reason)
    const relay_truncate_cell = RelayCell.Streamless.from(this, undefined, relay_truncate)
    this.tor.output.enqueue(relay_truncate_cell.cellOrThrow())

    await Plume.waitOrCloseOrErrorOrSignal(this.events, "RELAY_TRUNCATED", (future: Future<RelayCell.Streamless<RelayTruncatedCell>>, e) => {
      future.resolve(e)
      return new None()
    }, signal)
  }

  async tryTruncate(reason = RelayTruncateCell.reasons.NONE, signal?: AbortSignal): Promise<Result<void, Error>> {
    return await Result.runAndWrap(async () => {
      return await this.truncateOrThrow(reason, signal)
    }).then(r => r.mapErrSync(cause => new Error(`Could not truncate`, { cause })))
  }

  async openDirOrThrow(params: CircuitOpenParams = {}, signal = AbortSignals.never()) {
    if (this.closed?.reason != null)
      throw ErroredError.from(this.closed.reason)
    if (this.closed != null)
      throw ClosedError.from(this.closed.reason)

    const stream = new SecretTorStreamDuplex("directory", this.#streamId++, this)

    this.streams.set(stream.id, stream)

    const begin = new RelayBeginDirCell()
    const begin_cell = RelayCell.Streamful.from(this, stream, begin)
    this.tor.output.enqueue(begin_cell.cellOrThrow())

    if (!params.wait)
      return new TorStreamDuplex(stream)

    await Plume.waitOrCloseOrErrorOrSignal(stream.events.input, "open", (future: Future<void>) => {
      future.resolve(undefined)
      return new None()
    }, signal)

    return new TorStreamDuplex(stream)
  }

  async openOrThrow(hostname: string, port: number, params: CircuitOpenParams = {}, signal = AbortSignals.never()) {
    if (this.closed?.reason != null)
      throw ErroredError.from(this.closed.reason)
    if (this.closed != null)
      throw ClosedError.from(this.closed.reason)

    const { ipv6 = "preferred" } = params

    const stream = new SecretTorStreamDuplex("external", this.#streamId++, this)

    this.streams.set(stream.id, stream)

    const flags = new Bitset(0, 32)
      .setLE(RelayBeginCell.flags.IPV6_OK, IPv6[ipv6] !== IPv6.never)
      .setLE(RelayBeginCell.flags.IPV4_NOT_OK, IPv6[ipv6] === IPv6.always)
      .setLE(RelayBeginCell.flags.IPV6_PREFER, IPv6[ipv6] > IPv6.avoided)
      .unsign()
      .value

    const begin = RelayBeginCell.create(`${hostname}:${port}`, flags)
    const begin_cell = RelayCell.Streamful.from(this, stream, begin)
    this.tor.output.enqueue(begin_cell.cellOrThrow())

    if (!params.wait)
      return new TorStreamDuplex(stream)

    await Plume.waitOrCloseOrErrorOrSignal(stream.events.input, "open", (future: Future<void>) => {
      future.resolve(undefined)
      return new None()
    }, signal)

    return new TorStreamDuplex(stream)
  }

  async tryOpen(hostname: string, port: number, params: CircuitOpenParams = {}, signal = AbortSignals.never()): Promise<Result<TorStreamDuplex, Error>> {
    return await Result.runAndWrap(async () => {
      return await this.openOrThrow(hostname, port, params, signal)
    }).then(r => r.mapErrSync(cause => new Error(`Could not open`, { cause })))
  }

  async fetchConsensusOrThrow(signal = AbortSignals.never()) {
    const stream = await this.openDirOrThrow()
    const url = `http://localhost/tor/status-vote/current/consensus-microdesc.z`


  }

  async unrefOrThrow(ref: Microdesc.Pre) {
    const stream = await this.openDirOrThrow()
    const url = `http://localhost/tor/micro/d/${ref.microdesc}.z`

    const response = await fetch(url, { stream: stream.outer })

    if (!response.ok)
      throw new Error(`Could not fetch`)

    const buffer = await response.arrayBuffer()
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer))

    const digest64 = Base64.get().encodeUnpaddedOrThrow(digest)

    if (digest64 !== ref.microdesc)
      throw new Error(`Digest mismatch`)

    const text = Bytes.toUtf8(new Uint8Array(buffer))
    const [post] = Microdesc.parseOrThrow(text)

    if (post == null)
      throw new Error(`Could not parse`)

    return { ...ref, ...post } as Microdesc
  }

  async tryUnref(ref: Microdesc.Pre): Promise<Result<Microdesc, Error>> {
    return await Result.runAndWrap(async () => {
      return await this.unrefOrThrow(ref)
    }).then(r => r.mapErrSync(cause => new Error(`Could not unref`, { cause })))
  }

}