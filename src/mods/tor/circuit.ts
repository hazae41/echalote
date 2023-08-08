import { Arrays } from "@hazae41/arrays";
import { BinaryError, Opaque } from "@hazae41/binary";
import { Bitset } from "@hazae41/bitset";
import { Bytes, BytesCastError } from "@hazae41/bytes";
import { Ciphers, TlsClientDuplex } from "@hazae41/cadenas";
import { ControllerError } from "@hazae41/cascade";
import { PipeError, tryFetch } from "@hazae41/fleche";
import { Future } from "@hazae41/future";
import { None, Option, Some } from "@hazae41/option";
import { TooManyRetriesError } from "@hazae41/piscine";
import { AbortedError, CloseEvents, ClosedError, ErrorEvents, ErroredError, EventError, Plume, SuperEventTarget } from "@hazae41/plume";
import { Err, Ok, Result } from "@hazae41/result";
import { Aes128Ctr128BEKey } from "@hazae41/zepar";
import { CryptoError } from "libs/crypto/crypto.js";
import { AbortSignals } from "libs/signals/signals.js";
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

  get destroyed() {
    return Boolean(this.#secret.destroyed)
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

  async tryOpen(hostname: string, port: number, params?: CircuitOpenParams) {
    return await this.#secret.tryOpen(hostname, port, params)
  }

  async tryFetch(input: RequestInfo | URL, init: RequestInit & CircuitOpenParams = {}) {
    return await this.#secret.tryFetch(input, init)
  }

  async destroy() {
    return await this.#secret.destroy()
  }

}

export type SecretCircuitEvents = CloseEvents & ErrorEvents & {
  "RELAY_EXTENDED2": (cell: RelayCell.Streamless<RelayExtended2Cell<Opaque>>) => Result<void, Error>
  "RELAY_TRUNCATED": (cell: RelayCell.Streamless<RelayTruncatedCell>) => Result<void, Error>
  "RELAY_DATA": (cell: RelayCell.Streamful<RelayDataCell<Opaque>>) => Result<void, Error>
  "RELAY_END": (cell: RelayCell.Streamful<RelayEndCell>) => Result<void, Error>
}

export class SecretCircuit {
  readonly #class = SecretCircuit

  readonly events = new SuperEventTarget<SecretCircuitEvents>()

  readonly targets = new Array<Target>()
  readonly streams = new Map<number, SecretTorStreamDuplex>()

  #streamId = 1

  #destroyed?: { reason?: unknown }

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

  get destroyed() {
    return this.#destroyed
  }

  async #onTorClose() {
    console.debug(`${this.#class.name}.onTorClose`)

    this.#destroyed = {}

    await this.events.emit("close", [undefined])

    return new None()
  }

  async #onTorError(reason?: unknown) {
    console.debug(`${this.#class.name}.onReadError`, { reason })

    this.#destroyed = { reason }

    await this.events.emit("error", [reason])

    return new None()
  }

  async #onDestroyCell(cell: Cell.Circuitful<DestroyCell>) {
    if (cell.circuit !== this)
      return new None()

    console.debug(`${this.#class.name}.onDestroyCell`, cell)

    this.#destroyed = { reason: cell }

    await this.events.emit("error", [cell])

    return new None()
  }

  async #onRelayExtended2Cell(cell: RelayCell.Streamless<RelayExtended2Cell<Opaque>>) {
    if (cell.circuit !== this)
      return new None()

    console.debug(`${this.#class.name}.onRelayExtended2Cell`, cell)

    const returned = await this.events.emit("RELAY_EXTENDED2", [cell])

    if (returned.isSome() && returned.inner.isErr())
      return new Some(returned.inner.mapErrSync(EventError.new))

    return new None()
  }

  async #onRelayTruncatedCell(cell: RelayCell.Streamless<RelayTruncatedCell>): Promise<Option<Result<void, Error>>> {
    if (cell.circuit !== this)
      return new None()

    console.debug(`${this.#class.name}.onRelayTruncatedCell`, cell)

    this.#destroyed = {}

    await this.events.emit("error", [cell])

    const returned = await this.events.emit("RELAY_TRUNCATED", [cell])

    if (returned.isSome() && returned.inner.isErr())
      return new Some(returned.inner.mapErrSync(EventError.new))

    return new None()
  }

  async #onRelayConnectedCell(cell: RelayCell.Streamful<RelayConnectedCell>) {
    if (cell.circuit !== this)
      return new None()

    console.debug(`${this.#class.name}.onRelayConnectedCell`, cell)

    return new None()
  }

  async #onRelayDataCell(cell: RelayCell.Streamful<RelayDataCell<Opaque>>) {
    if (cell.circuit !== this)
      return new None()

    console.debug(`${this.#class.name}.onRelayDataCell`, cell)

    const returned = await this.events.emit("RELAY_DATA", [cell])

    if (returned.isSome() && returned.inner.isErr())
      return new Some(returned.inner.mapErrSync(EventError.new))

    return new None()
  }

  async #onRelayEndCell(cell: RelayCell.Streamful<RelayEndCell>) {
    if (cell.circuit !== this)
      return new None()

    console.debug(`${this.#class.name}.onRelayEndCell`, cell)

    this.streams.delete(cell.stream.id)

    const returned = await this.events.emit("RELAY_END", [cell])

    if (returned.isSome() && returned.inner.isErr())
      return new Some(returned.inner.mapErrSync(EventError.new))

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

  async tryExtendLoop(exit: boolean, signal?: AbortSignal): Promise<Result<void, CryptoError | TooManyRetriesError | EmptyFallbacksError | InvalidNtorAuthError | ClosedError | BinaryError | AbortedError | ErroredError>> {
    for (let i = 0; !this.destroyed && !signal?.aborted && i < 3; i++) {
      const result = await this.tryExtend(exit, signal)

      if (result.isOk())
        return result

      if (this.destroyed)
        return result
      if (signal?.aborted)
        return result

      if (result.inner.name === AbortedError.name) {
        console.debug("Extend aborted", { error: result.get() })
        await new Promise(ok => setTimeout(ok, 1000 * (2 ** i)))
        continue
      }

      if (result.inner.name === InvalidNtorAuthError.name) {
        console.debug("Extend failed", { error: result.get() })
        await new Promise(ok => setTimeout(ok, 1000 * (2 ** i)))
        continue
      }

      return result
    }

    if (this.destroyed?.reason !== undefined)
      return new Err(ErroredError.from(this.destroyed.reason))
    if (this.destroyed !== undefined)
      return new Err(ClosedError.from(this.destroyed.reason))
    if (signal?.aborted)
      return new Err(AbortedError.from(signal.reason))
    return new Err(new TooManyRetriesError())
  }

  async tryExtend(exit: boolean, signal?: AbortSignal): Promise<Result<void, CryptoError | EmptyFallbacksError | InvalidNtorAuthError | ClosedError | BinaryError | AbortedError | ErroredError>> {
    if (this.destroyed?.reason !== undefined)
      return new Err(ErroredError.from(this.destroyed.reason))
    if (this.destroyed !== undefined)
      return new Err(ClosedError.from(this.destroyed.reason))

    const fallbacks = exit
      ? this.tor.params.fallbacks.filter(it => it.exit)
      : this.tor.params.fallbacks

    const fallback = Arrays.cryptoRandom(fallbacks)

    if (fallback == null)
      return new Err(new EmptyFallbacksError())

    return await this.tryExtendTo(fallback, signal)
  }

  async tryExtendTo(fallback: Fallback, signal?: AbortSignal): Promise<Result<void, CryptoError | BytesCastError | InvalidNtorAuthError | BinaryError | AbortedError | ErroredError | ClosedError>> {
    return await Result.unthrow(async t => {
      if (this.destroyed?.reason !== undefined)
        return new Err(ErroredError.from(this.destroyed.reason))
      if (this.destroyed !== undefined)
        return new Err(ClosedError.from(this.destroyed.reason))

      const signal2 = AbortSignals.timeout(5_000, signal)

      const relayid_rsa = Bytes.tryCast(Bytes.fromHex(fallback.id), HASH_LEN).throw(t)
      const relayid_ed = Option.wrap(fallback.eid).mapSync(Bytes.fromBase64).get()

      const links: RelayExtend2Link[] = fallback.hosts.map(RelayExtend2Link.fromAddressString)

      links.push(new RelayExtend2LinkLegacyID(relayid_rsa))

      if (relayid_ed)
        links.push(new RelayExtend2LinkModernID(relayid_ed))

      const { StaticSecret, PublicKey } = this.tor.params.x25519

      const wasm_secret_x = await Promise
        .resolve(StaticSecret.tryCreate())
        .then(r => r.mapErrSync(CryptoError.from).throw(t))

      const unsized_public_x = await Promise
        .resolve(wasm_secret_x.tryGetPublicKey())
        .then(r => r.mapErrSync(CryptoError.from).throw(t))

      const unsized_public_x_bytes = await Promise
        .resolve(unsized_public_x.tryExport())
        .then(r => r.mapErrSync(CryptoError.from).throw(t))

      const public_x = Bytes.tryCast(unsized_public_x_bytes, 32).throw(t)
      const public_b = Bytes.tryCastFrom(fallback.onion, 32).throw(t)

      const ntor_request = new Ntor.NtorRequest(public_x, relayid_rsa, public_b)
      const relay_extend2 = new RelayExtend2Cell(RelayExtend2Cell.types.NTOR, links, ntor_request)
      this.tor.writer.enqueue(RelayEarlyCell.Streamless.from(this, undefined, relay_extend2).tryCell().throw(t))

      const msg_extended2 = await Plume.tryWaitOrCloseOrErrorOrSignal(this.events, "RELAY_EXTENDED2", (future: Future<Ok<RelayCell.Streamless<RelayExtended2Cell<Opaque>>>>, e) => {
        future.resolve(new Ok(e))
        return new None()
      }, signal2).then(r => r.throw(t))

      const response = msg_extended2.fragment.fragment.tryReadInto(Ntor.NtorResponse).throw(t)

      const { public_y } = response

      const wasm_public_y = await Promise
        .resolve(PublicKey.tryImport(public_y))
        .then(r => r.mapErrSync(CryptoError.from).throw(t))

      const wasm_public_b = await Promise
        .resolve(PublicKey.tryImport(public_b))
        .then(r => r.mapErrSync(CryptoError.from).throw(t))

      const unsized_shared_xy = await Promise
        .resolve(wasm_secret_x.tryComputeDiffieHellman(wasm_public_y))
        .then(r => r.mapErrSync(CryptoError.from).throw(t))

      const unsized_shared_xy_bytes = await Promise
        .resolve(unsized_shared_xy.tryExport())
        .then(r => r.mapErrSync(CryptoError.from).throw(t))

      const unsized_shared_xb = await Promise
        .resolve(wasm_secret_x.tryComputeDiffieHellman(wasm_public_b))
        .then(r => r.mapErrSync(CryptoError.from).throw(t))

      const unsized_shared_xb_bytes = await Promise
        .resolve(unsized_shared_xb.tryExport())
        .then(r => r.mapErrSync(CryptoError.from).throw(t))

      const shared_xy = Bytes.tryCast(unsized_shared_xy_bytes, 32).throw(t)
      const shared_xb = Bytes.tryCast(unsized_shared_xb_bytes, 32).throw(t)

      const result = await NtorResult.tryFinalize(shared_xy, shared_xb, relayid_rsa, public_b, public_x, public_y).then(r => r.throw(t))

      if (!Bytes.equals2(response.auth, result.auth))
        return new Err(new InvalidNtorAuthError())

      const forward_digest = new this.tor.params.sha1.Hasher()
      const backward_digest = new this.tor.params.sha1.Hasher()

      forward_digest.update(result.forwardDigest)
      backward_digest.update(result.backwardDigest)

      const forward_key = new Aes128Ctr128BEKey(result.forwardKey, Bytes.alloc(16))
      const backward_key = new Aes128Ctr128BEKey(result.backwardKey, Bytes.alloc(16))

      const target = new Target(relayid_rsa, this, forward_digest, backward_digest, forward_key, backward_key)

      this.targets.push(target)

      return Ok.void()
    })
  }

  async destroy(reason?: unknown) {
    this.#destroyed = { reason }
    await this.events.emit("error", [reason])
  }

  async tryTruncate(reason = RelayTruncateCell.reasons.NONE, signal?: AbortSignal): Promise<Result<void, BinaryError | ClosedError | AbortedError | ErroredError>> {
    return await Result.unthrow(async t => {
      const signal2 = AbortSignals.timeout(5_000, signal)

      const relay_truncate = new RelayTruncateCell(reason)
      const relay_truncate_cell = RelayCell.Streamless.from(this, undefined, relay_truncate)
      this.tor.writer.enqueue(relay_truncate_cell.tryCell().throw(t))

      await Plume.tryWaitOrCloseOrErrorOrSignal(this.events, "RELAY_TRUNCATED", (future: Future<Ok<RelayCell.Streamless<RelayTruncatedCell>>>, e) => {
        future.resolve(new Ok(e))
        return new None()
      }, signal2).then(r => r.throw(t))

      return Ok.void()
    })
  }

  async tryOpen(hostname: string, port: number, params: CircuitOpenParams = {}): Promise<Result<TorStreamDuplex, BinaryError | ErroredError | ClosedError | ControllerError>> {
    return await Result.unthrow(async t => {
      if (this.destroyed?.reason !== undefined)
        return new Err(ErroredError.from(this.destroyed.reason))
      if (this.destroyed !== undefined)
        return new Err(ClosedError.from(this.destroyed.reason))

      const { ipv6 = "preferred" } = params

      const stream = new SecretTorStreamDuplex(this.#streamId++, this)

      this.streams.set(stream.id, stream)

      const flags = new Bitset(0, 32)
        .setLE(RelayBeginCell.flags.IPV6_OK, IPv6[ipv6] !== IPv6.never)
        .setLE(RelayBeginCell.flags.IPV4_NOT_OK, IPv6[ipv6] === IPv6.always)
        .setLE(RelayBeginCell.flags.IPV6_PREFER, IPv6[ipv6] > IPv6.avoided)
        .unsign()
        .value

      const begin = new RelayBeginCell(`${hostname}:${port}`, flags)
      const begin_cell = RelayCell.Streamful.from(this, stream, begin)
      this.tor.writer.tryEnqueue(begin_cell.tryCell().throw(t)).throw(t)

      return new Ok(new TorStreamDuplex(stream))
    })
  }

  /**
   * Fetch using HTTP
   * @param input Fetch input
   * @param init Fetch init
   * @returns Response promise
   */
  async tryFetch(input: RequestInfo | URL, init: RequestInit & CircuitOpenParams): Promise<Result<Response, UnknownProtocolError | BinaryError | AbortedError | ErroredError | ClosedError | PipeError | ControllerError>> {
    return await Result.unthrow(async t => {
      if (this.destroyed?.reason !== undefined)
        return new Err(ErroredError.from(this.destroyed.reason))
      if (this.destroyed !== undefined)
        return new Err(ClosedError.from(this.destroyed.reason))

      const req = new Request(input, init)

      const url = new URL(req.url)

      if (url.protocol === "http:") {
        const port = Number(url.port) || 80

        const tcp = await this.tryOpen(url.hostname, port, init).then(r => r.throw(t))

        return tryFetch(input, { ...init, stream: tcp })
      }

      if (url.protocol === "https:") {
        const port = Number(url.port) || 443

        const tcp = await this.tryOpen(url.hostname, port, init).then(r => r.throw(t))

        const ciphers = [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384]
        const tls = new TlsClientDuplex(tcp, { host_name: url.hostname, ciphers })

        return tryFetch(input, { ...init, stream: tls })
      }

      return new Err(new UnknownProtocolError(url.protocol))
    })
  }

}