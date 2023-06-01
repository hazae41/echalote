import { Arrays } from "@hazae41/arrays";
import { BinaryError, BinaryWriteError, Opaque } from "@hazae41/binary";
import { Bitset } from "@hazae41/bitset";
import { Bytes, BytesCastError } from "@hazae41/bytes";
import { Ciphers, TlsClientDuplex } from "@hazae41/cadenas";
import { ControllerError } from "@hazae41/cascade";
import { PipeError, tryFetch } from "@hazae41/fleche";
import { Option, Some } from "@hazae41/option";
import { AbortError, CloseError, ErrorError, EventError, Plume, StreamEvents, SuperEventTarget } from "@hazae41/plume";
import { Err, Ok, Result } from "@hazae41/result";
import { Aes128Ctr128BEKey } from "@hazae41/zepar";
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
import { TooManyRetriesError } from "./errors.js";

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

  readonly events = new SuperEventTarget<StreamEvents>()

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
    return this.events.tryEmit("close", undefined).then(r => r.clear())
  }

  async #onError(reason?: unknown) {
    return this.events.tryEmit("error", reason).then(r => r.clear())
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

  async tryDestroy() {
    return await this.#secret.tryDestroy()
  }

}

export type SecretCircuitEvents = StreamEvents & {
  "RELAY_EXTENDED2": RelayCell.Streamless<RelayExtended2Cell<Opaque>>,
  "RELAY_TRUNCATED": RelayCell.Streamless<RelayTruncatedCell>
  "RELAY_DATA": RelayCell.Streamful<RelayDataCell<Opaque>>
  "RELAY_END": RelayCell.Streamful<RelayEndCell>,
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

    return await this.events.tryEmit("close", undefined).then(r => r.clear())
  }

  async #onTorError(reason?: unknown) {
    console.debug(`${this.#class.name}.onReadError`, { reason })

    this.#destroyed = { reason }

    return await this.events.tryEmit("error", reason).then(r => r.clear())
  }

  async #onDestroyCell(cell: Cell.Circuitful<DestroyCell>) {
    if (cell.circuit !== this)
      return Ok.void()

    console.debug(`${this.#class.name}.onDestroyCell`, cell)

    this.#destroyed = { reason: cell }

    return await this.events.tryEmit("error", cell).then(r => r.clear())
  }

  async #onRelayExtended2Cell(cell: RelayCell.Streamless<RelayExtended2Cell<Opaque>>) {
    if (cell.circuit !== this)
      return Ok.void()

    console.debug(`${this.#class.name}.onRelayExtended2Cell`, cell)

    return await this.events.tryEmit("RELAY_EXTENDED2", cell).then(r => r.clear())
  }

  async #onRelayTruncatedCell(cell: RelayCell.Streamless<RelayTruncatedCell>) {
    return await Result.unthrow(async t => {
      if (cell.circuit !== this)
        return Ok.void()

      console.debug(`${this.#class.name}.onRelayTruncatedCell`, cell)

      this.#destroyed = {}

      await this.events.tryEmit("RELAY_TRUNCATED", cell).then(r => r.throw(t))
      await this.events.tryEmit("error", cell).then(r => r.throw(t))

      return Ok.void()
    })
  }

  async #onRelayConnectedCell(cell: RelayCell.Streamful<RelayConnectedCell>) {
    if (cell.circuit !== this)
      return Ok.void()

    console.debug(`${this.#class.name}.onRelayConnectedCell`, cell)

    return Ok.void()
  }

  async #onRelayDataCell(cell: RelayCell.Streamful<RelayDataCell<Opaque>>) {
    if (cell.circuit !== this)
      return Ok.void()

    console.debug(`${this.#class.name}.onRelayDataCell`, cell)

    return await this.events.tryEmit("RELAY_DATA", cell).then(r => r.clear())
  }

  async #onRelayEndCell(cell: RelayCell.Streamful<RelayEndCell>) {
    if (cell.circuit !== this)
      return Ok.void()

    console.debug(`${this.#class.name}.onRelayEndCell`, cell)

    this.streams.delete(cell.stream.id)

    return await this.events.tryEmit("RELAY_END", cell).then(r => r.clear())
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

  async tryExtendLoop(exit: boolean, signal?: AbortSignal): Promise<Result<void, TooManyRetriesError | EmptyFallbacksError | InvalidNtorAuthError | CloseError | BinaryError | AbortError | ErrorError>> {
    for (let i = 0; !this.destroyed && !signal?.aborted && i < 3; i++) {
      const result = await this.tryExtend(exit, signal)

      if (result.isOk())
        return result

      if (this.destroyed)
        return result
      if (signal?.aborted)
        return result

      if (result.inner.name === AbortError.name) {
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
      return new Err(ErrorError.from(this.destroyed.reason))
    if (this.destroyed !== undefined)
      return new Err(CloseError.from(this.destroyed.reason))
    if (signal?.aborted)
      return new Err(AbortError.from(signal.reason))
    return new Err(new TooManyRetriesError())
  }

  async tryExtend(exit: boolean, signal?: AbortSignal): Promise<Result<void, EmptyFallbacksError | InvalidNtorAuthError | CloseError | BinaryError | AbortError | ErrorError>> {
    if (this.destroyed?.reason !== undefined)
      return new Err(ErrorError.from(this.destroyed.reason))
    if (this.destroyed !== undefined)
      return new Err(CloseError.from(this.destroyed.reason))

    const fallbacks = exit
      ? this.tor.params.fallbacks.filter(it => it.exit)
      : this.tor.params.fallbacks

    if (!fallbacks.length)
      return new Err(new EmptyFallbacksError())

    const fallback = Arrays.cryptoRandom(fallbacks)

    return await this.tryExtendTo(fallback, signal)
  }

  async tryExtendTo(fallback: Fallback, signal?: AbortSignal): Promise<Result<void, BytesCastError | InvalidNtorAuthError | BinaryError | AbortError | ErrorError | CloseError>> {
    return await Result.unthrow(async t => {
      if (this.destroyed?.reason !== undefined)
        return new Err(ErrorError.from(this.destroyed.reason))
      if (this.destroyed !== undefined)
        return new Err(CloseError.from(this.destroyed.reason))

      const signal2 = AbortSignals.timeout(5_000, signal)

      const relayid_rsa = Bytes.tryCast(Bytes.fromHex(fallback.id), HASH_LEN).throw(t)
      const relayid_ed = Option.from(fallback.eid).mapSync(Bytes.fromBase64).get()

      const links: RelayExtend2Link[] = fallback.hosts.map(RelayExtend2Link.fromAddressString)

      links.push(new RelayExtend2LinkLegacyID(relayid_rsa))

      if (relayid_ed)
        links.push(new RelayExtend2LinkModernID(relayid_ed))

      const { StaticSecret, PublicKey } = this.tor.params.x25519

      const wasm_secret_x = new StaticSecret()

      const public_x = Bytes.tryCast(wasm_secret_x.to_public().to_bytes(), 32).throw(t)
      const public_b = Bytes.tryCastFrom(fallback.onion, 32).throw(t)

      const ntor_request = new Ntor.NtorRequest(public_x, relayid_rsa, public_b)
      const relay_extend2 = new RelayExtend2Cell(RelayExtend2Cell.types.NTOR, links, ntor_request)
      this.tor.writer.enqueue(RelayEarlyCell.Streamless.from(this, undefined, relay_extend2).tryCell().throw(t))

      const msg_extended2 = await Plume.tryWaitOrStreamOrSignal(this.events, "RELAY_EXTENDED2", e => {
        return new Ok(new Some(new Ok(e)))
      }, signal2).then(r => r.throw(t))

      const response = msg_extended2.fragment.fragment.tryReadInto(Ntor.NtorResponse).throw(t)

      const { public_y } = response

      const wasm_public_y = new PublicKey(public_y)
      const wasm_public_b = new PublicKey(public_b)

      const shared_xy = Bytes.tryCast(wasm_secret_x.diffie_hellman(wasm_public_y).to_bytes(), 32).throw(t)
      const shared_xb = Bytes.tryCast(wasm_secret_x.diffie_hellman(wasm_public_b).to_bytes(), 32).throw(t)

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

  async tryDestroy(reason?: unknown): Promise<Result<void, EventError>> {
    this.#destroyed = { reason }

    return await this.events.tryEmit("error", reason).then(r => r.clear())
  }

  async tryTruncate(reason = RelayTruncateCell.reasons.NONE, signal?: AbortSignal) {
    return await Result.unthrow(async t => {
      const signal2 = AbortSignals.timeout(5_000, signal)

      const relay_truncate = new RelayTruncateCell(reason)
      const relay_truncate_cell = RelayCell.Streamless.from(this, undefined, relay_truncate)
      this.tor.writer.enqueue(relay_truncate_cell.tryCell().throw(t))

      return await Plume.tryWaitOrStreamOrSignal(this.events, "RELAY_TRUNCATED", e => {
        return new Ok(new Some(Ok.void()))
      }, signal2)
    })
  }

  async tryOpen(hostname: string, port: number, params: CircuitOpenParams = {}): Promise<Result<TorStreamDuplex, BinaryWriteError | ErrorError | CloseError | ControllerError>> {
    return await Result.unthrow(async t => {
      if (this.destroyed?.reason !== undefined)
        return new Err(ErrorError.from(this.destroyed.reason))
      if (this.destroyed !== undefined)
        return new Err(CloseError.from(this.destroyed.reason))

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
  async tryFetch(input: RequestInfo | URL, init: RequestInit & CircuitOpenParams): Promise<Result<Response, UnknownProtocolError | BinaryWriteError | AbortError | ErrorError | CloseError | PipeError | ControllerError>> {
    return await Result.unthrow(async t => {
      if (this.destroyed?.reason !== undefined)
        return new Err(ErrorError.from(this.destroyed.reason))
      if (this.destroyed !== undefined)
        return new Err(CloseError.from(this.destroyed.reason))

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
        const tls = new TlsClientDuplex(tcp, { ciphers })

        return tryFetch(input, { ...init, stream: tls })
      }

      return new Err(new UnknownProtocolError(url.protocol))
    })
  }

}