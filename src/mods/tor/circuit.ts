import { Arrays } from "@hazae41/arrays";
import { Base16 } from "@hazae41/base16";
import { Base64 } from "@hazae41/base64";
import { Opaque, Writable } from "@hazae41/binary";
import { Bitset } from "@hazae41/bitset";
import { Bytes } from "@hazae41/bytes";
import { Ciphers, TlsClientDuplex } from "@hazae41/cadenas";
import { Future } from "@hazae41/future";
import { None, Option } from "@hazae41/option";
import { TooManyRetriesError } from "@hazae41/piscine";
import { AbortedError, CloseEvents, ClosedError, ErrorEvents, ErroredError, Plume, SuperEventTarget } from "@hazae41/plume";
import { Err, Ok, Result } from "@hazae41/result";
import { Sha1 } from "@hazae41/sha1";
import { X25519 } from "@hazae41/x25519";
import { Aes128Ctr128BEKey, Zepar } from "@hazae41/zepar";
import { AbortSignals } from "libs/signals/signals.js";
import { Console } from "mods/console/index.js";
import { Ntor } from "mods/tor/algorithms/ntor/index.js";
import { DestroyCell } from "mods/tor/binary/cells/direct/destroy/cell.js";
import { RelayBeginCell } from "mods/tor/binary/cells/relayed/relay_begin/cell.js";
import { RelayConnectedCell } from "mods/tor/binary/cells/relayed/relay_connected/cell.js";
import { RelayDataCell } from "mods/tor/binary/cells/relayed/relay_data/cell.js";
import { RelayEndCell } from "mods/tor/binary/cells/relayed/relay_end/cell.js";
import { RelayExtend2Cell } from "mods/tor/binary/cells/relayed/relay_extend2/cell.js";
import { RelayExtend2Link, RelayExtend2LinkLegacyID, RelayExtend2LinkModernID } from "mods/tor/binary/cells/relayed/relay_extend2/link.js";
import { RelayExtended2Cell } from "mods/tor/binary/cells/relayed/relay_extended2/cell.js";
import { RelayTruncateCell } from "mods/tor/binary/cells/relayed/relay_truncate/cell.js";
import { RelayTruncatedCell } from "mods/tor/binary/cells/relayed/relay_truncated/cell.js";
import { SecretTorStreamDuplex, TorStreamDuplex } from "mods/tor/stream.js";
import { Target } from "mods/tor/target.js";
import { Fallback, SecretTorClientDuplex } from "mods/tor/tor.js";
import { InvalidNtorAuthError, NtorResult } from "./algorithms/ntor/ntor.js";
import { Cell } from "./binary/cells/cell.js";
import { RelayCell } from "./binary/cells/direct/relay/cell.js";
import { RelayEarlyCell } from "./binary/cells/direct/relay_early/cell.js";
import { HASH_LEN } from "./constants.js";

export const IPv6 = {
  always: 3,
  preferred: 2,
  avoided: 1,
  never: 0
} as const

export interface CircuitOpenParams {
  ipv6?: keyof typeof IPv6
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

  async tryExtend(exit: boolean, signal: AbortSignal) {
    return await this.#secret.tryExtend(exit, signal)
  }

  async tryExtendLoop(exit: boolean, signal?: AbortSignal) {
    return await this.#secret.tryExtendLoop(exit, signal)
  }

  async openOrThrow(hostname: string, port: number, params?: CircuitOpenParams) {
    return await this.#secret.openOrThrow(hostname, port, params)
  }

  async tryOpen(hostname: string, port: number, params?: CircuitOpenParams) {
    return await this.#secret.tryOpen(hostname, port, params)
  }

  async openAsOrThrow(input: RequestInfo | URL, params?: CircuitOpenParams) {
    return await this.#secret.openAsOrThrow(input, params)
  }

  async close() {
    return await this.#secret.close()
  }

}

export type SecretCircuitEvents = CloseEvents & ErrorEvents & {
  /**
   * Used by self
   */
  "RELAY_EXTENDED2": (cell: RelayCell.Streamless<RelayExtended2Cell<Opaque>>) => Result<void, Error>
  "RELAY_TRUNCATED": (cell: RelayCell.Streamless<RelayTruncatedCell>) => Result<void, Error>

  /**
   * Used by streams
   */
  "RELAY_DATA": (cell: RelayCell.Streamful<RelayDataCell<Opaque>>) => Result<void, Error>
  "RELAY_END": (cell: RelayCell.Streamful<RelayEndCell>) => Result<void, Error>
}

export class SecretCircuit {
  readonly #class = SecretCircuit

  readonly events = new SuperEventTarget<SecretCircuitEvents>()

  readonly targets = new Array<Target>()
  readonly streams = new Map<number, SecretTorStreamDuplex>()

  #streamId = 1

  #closed?: { reason?: unknown }

  constructor(
    readonly id: number,
    readonly tor: SecretTorClientDuplex
  ) {
    const onClose = this.#onTorClose.bind(this)
    this.tor.events.on("close", onClose, { passive: true })

    const onError = this.#onTorError.bind(this)
    this.tor.events.on("error", onError, { passive: true })

    const onDestroyCell = this.#onDestroyCell.bind(this)
    this.tor.events.on("DESTROY", onDestroyCell, { passive: true })

    const onRelayExtended2Cell = this.#onRelayExtended2Cell.bind(this)
    this.tor.events.on("RELAY_EXTENDED2", onRelayExtended2Cell, { passive: true })

    const onRelayTruncatedCell = this.#onRelayTruncatedCell.bind(this)
    this.tor.events.on("RELAY_TRUNCATED", onRelayTruncatedCell, { passive: true })

    const onRelayConnectedCell = this.#onRelayConnectedCell.bind(this)
    this.tor.events.on("RELAY_CONNECTED", onRelayConnectedCell, { passive: true })

    const onRelayDataCell = this.#onRelayDataCell.bind(this)
    this.tor.events.on("RELAY_DATA", onRelayDataCell, { passive: true })

    const onRelayEndCell = this.#onRelayEndCell.bind(this)
    this.tor.events.on("RELAY_END", onRelayEndCell, { passive: true })
  }

  [Symbol.dispose]() {
    if (!this.#closed)
      this.#closed = {}
    for (const target of this.targets)
      target[Symbol.dispose]()
  }

  get closed() {
    return this.#closed
  }

  #onCloseOrError(reason?: unknown) {
    if (this.#closed)
      return
    this.#closed = { reason }
    this[Symbol.dispose]()
  }

  async close(reason: number = DestroyCell.reasons.NONE) {
    const error = new DestroyedError(reason)

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

  async #onRelayConnectedCell(cell: RelayCell.Streamful<RelayConnectedCell>) {
    if (cell.circuit !== this)
      return new None()

    Console.debug(`${this.#class.name}.onRelayConnectedCell`, cell)

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

  // async tryExtendDir(signal: AbortSignal) {
  //   const authority = Arrays.cryptoRandom(this.tor.authorities.filter(it => it.v3ident))

  //   if (!authority)
  //     t new Error(`Could not find authority`)

  //   await this.#tryExtendTo({
  //     hosts: [authority.ipv4],
  //     id: authority.v3ident!,
  //     onion: authority.fingerprint,
  //   }, signal)
  // }

  async extendOrThrow(exit: boolean, signal?: AbortSignal) {
    if (this.closed?.reason != null)
      throw ErroredError.from(this.closed.reason)
    if (this.closed != null)
      throw ClosedError.from(this.closed.reason)

    const fallbacks = exit
      ? this.tor.params.fallbacks.filter(it => it.exit)
      : this.tor.params.fallbacks

    const fallback = Arrays.cryptoRandom(fallbacks)

    if (fallback == null)
      throw new EmptyFallbacksError()

    return await this.extendToOrThrow(fallback, signal)
  }

  async extendToOrThrow(fallback: Fallback, signal?: AbortSignal) {
    if (this.closed?.reason != null)
      throw ErroredError.from(this.closed.reason)
    if (this.closed != null)
      throw ClosedError.from(this.closed.reason)

    const signal2 = AbortSignals.timeout(5_000, signal)

    const relayid_rsax = Base16.get().padStartAndDecodeOrThrow(fallback.id).copyAndDispose()
    const relayid_rsa = Bytes.castOrThrow(relayid_rsax, HASH_LEN)

    const relayid_ed = Option.mapSync(fallback.eid, Base64.get().decodeUnpaddedOrThrow)?.copyAndDispose()

    const links: RelayExtend2Link[] = fallback.hosts.map(RelayExtend2Link.fromAddressString)

    links.push(new RelayExtend2LinkLegacyID(relayid_rsa))

    if (relayid_ed != null)
      links.push(new RelayExtend2LinkModernID(relayid_ed))

    using wasm_secret_x = await X25519.get().PrivateKey.tryRandom().then(r => r.unwrap())
    using wasm_public_x = wasm_secret_x.tryGetPublicKey().unwrap()

    const unsized_public_x_bytes = await wasm_public_x.tryExport().then(r => r.unwrap().copyAndDispose())

    const public_x = Bytes.castOrThrow(unsized_public_x_bytes, 32)
    const public_b = Bytes.fromAndCastOrThrow(fallback.onion, 32)

    const ntor_request = new Ntor.NtorRequest(public_x, relayid_rsa, public_b)
    const relay_extend2 = new RelayExtend2Cell(RelayExtend2Cell.types.NTOR, links, ntor_request)
    this.tor.output.enqueue(RelayEarlyCell.Streamless.from(this, undefined, relay_extend2).cellOrThrow())

    const msg_extended2 = await Plume.tryWaitOrCloseOrErrorOrSignal(this.events, "RELAY_EXTENDED2", (future: Future<Ok<RelayCell.Streamless<RelayExtended2Cell<Opaque>>>>, e) => {
      future.resolve(new Ok(e))
      return new None()
    }, signal2).then(r => r.unwrap())

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

  async tryExtend(exit: boolean, signal?: AbortSignal) {
    return await Result.runAndWrap(async () => {
      return await this.extendOrThrow(exit, signal)
    }).then(r => r.mapErrSync(cause => new Error(`Could not extend`, { cause })))
  }

  async tryExtendLoop(exit: boolean, signal?: AbortSignal): Promise<Result<void, Error>> {
    for (let i = 0; !this.closed && !signal?.aborted && i < 3; i++) {
      const result = await this.tryExtend(exit, signal)

      if (result.isOk())
        return result

      if (this.closed)
        return result
      if (signal?.aborted)
        return result

      if (result.inner.name === AbortedError.name) {
        Console.debug("Extend aborted", { error: result.get() })
        await new Promise(ok => setTimeout(ok, 1000 * (2 ** i)))
        continue
      }

      if (result.inner.name === InvalidNtorAuthError.name) {
        Console.debug("Extend failed", { error: result.get() })
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

  async truncateOrThrow(reason = RelayTruncateCell.reasons.NONE, signal?: AbortSignal) {
    const signal2 = AbortSignals.timeout(5_000, signal)

    const relay_truncate = new RelayTruncateCell(reason)
    const relay_truncate_cell = RelayCell.Streamless.from(this, undefined, relay_truncate)
    this.tor.output.enqueue(relay_truncate_cell.cellOrThrow())

    await Plume.tryWaitOrCloseOrErrorOrSignal(this.events, "RELAY_TRUNCATED", (future: Future<Ok<RelayCell.Streamless<RelayTruncatedCell>>>, e) => {
      future.resolve(new Ok(e))
      return new None()
    }, signal2).then(r => r.unwrap())
  }

  async tryTruncate(reason = RelayTruncateCell.reasons.NONE, signal?: AbortSignal) {
    return await Result.runAndWrap(async () => {
      return await this.truncateOrThrow(reason, signal)
    }).then(r => r.mapErrSync(cause => new Error(`Could not truncate`, { cause })))
  }

  async openOrThrow(hostname: string, port: number, params: CircuitOpenParams = {}) {
    if (this.closed?.reason != null)
      throw ErroredError.from(this.closed.reason)
    if (this.closed != null)
      throw ClosedError.from(this.closed.reason)

    const { ipv6 = "preferred" } = params

    const stream = new SecretTorStreamDuplex(this.#streamId++, this)

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

    return new TorStreamDuplex(stream)
  }

  async tryOpen(hostname: string, port: number, params: CircuitOpenParams = {}) {
    return await Result.runAndWrap(async () => {
      return await this.openOrThrow(hostname, port, params)
    }).then(r => r.mapErrSync(cause => new Error(`Could not open`, { cause })))
  }

  async openAsOrThrow(input: RequestInfo | URL, params: CircuitOpenParams = {}): Promise<ReadableWritablePair<Opaque, Writable>> {
    if (this.closed?.reason != null)
      throw ErroredError.from(this.closed.reason)
    if (this.closed != null)
      throw ClosedError.from(this.closed.reason)

    const req = new Request(input)
    const url = new URL(req.url)

    if (url.protocol === "http:")
      return await this.openOrThrow(url.hostname, Number(url.port) || 80, params)

    if (url.protocol === "https:") {
      const tcp = await this.openOrThrow(url.hostname, Number(url.port) || 443, params)

      const ciphers = [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384]
      const tls = new TlsClientDuplex({ host_name: url.hostname, ciphers })

      tcp.readable.pipeTo(tls.inner.writable).catch(() => { })
      tls.inner.readable.pipeTo(tcp.writable).catch(() => { })

      return tls.outer
    }

    throw new UnknownProtocolError(url.protocol)
  }

  async tryOpenAs(input: RequestInfo | URL, params: CircuitOpenParams = {}): Promise<Result<ReadableWritablePair<Opaque, Writable>, Error>> {
    return await Result.runAndWrap(async () => {
      return await this.openAsOrThrow(input, params)
    }).then(r => r.mapErrSync(cause => new Error(`Could not open`, { cause })))
  }

}