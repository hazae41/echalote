import { X25519PublicKey, X25519StaticSecret } from "@hazae41/berith";
import { Opaque } from "@hazae41/binary";
import { Bitset } from "@hazae41/bitset";
import { Bytes } from "@hazae41/bytes";
import { Ciphers, TlsClientDuplex } from "@hazae41/cadenas";
import { fetch } from "@hazae41/fleche";
import { Sha1Hasher } from "@hazae41/morax";
import { Aes128Ctr128BEKey } from "@hazae41/zepar";
import { Arrays } from "libs/arrays/arrays.js";
import { CloseAndErrorEvents, Events } from "libs/events/events.js";
import { AsyncEventTarget } from "libs/events/target.js";
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
import { TcpStream } from "mods/tor/streams/tcp.js";
import { Target } from "mods/tor/target.js";
import { Fallback, Tor } from "mods/tor/tor.js";
import { LoopParams } from "mods/tor/types/loop.js";
import { RelayCell } from "./binary/cells/direct/relay/cell.js";
import { RelayEarlyCell } from "./binary/cells/direct/relay_early/cell.js";

export type CircuitEvents = CloseAndErrorEvents & {
  "RELAY_EXTENDED2": MessageEvent<RelayExtended2Cell<Opaque>>,
  "RELAY_DATA": MessageEvent<RelayDataCell<Opaque>>
  "RELAY_END": MessageEvent<RelayEndCell>,
  "RELAY_TRUNCATED": MessageEvent<RelayTruncatedCell>
}

export class Circuit {
  readonly #class = Circuit

  readonly events = new AsyncEventTarget<CircuitEvents>()

  readonly targets = new Array<Target>()
  readonly streams = new Map<number, TcpStream>()

  #streamId = 1

  #closed?: { reason?: any }

  constructor(
    readonly tor: Tor,
    readonly id: number
  ) {
    const onClose = this.#onTorClose.bind(this)
    this.tor.events.addEventListener("close", onClose, { passive: true })

    const onError = this.#onTorError.bind(this)
    this.tor.events.addEventListener("error", onError, { passive: true })

    const onDestroyCell = this.#onDestroyCell.bind(this)
    this.tor.events.addEventListener("DESTROY", onDestroyCell, { passive: true })

    const onRelayExtended2Cell = this.#onRelayExtended2Cell.bind(this)
    this.tor.events.addEventListener("RELAY_EXTENDED2", onRelayExtended2Cell, { passive: true })

    const onRelayTruncatedCell = this.#onRelayTruncatedCell.bind(this)
    this.tor.events.addEventListener("RELAY_TRUNCATED", onRelayTruncatedCell, { passive: true })

    const onRelayConnectedCell = this.#onRelayConnectedCell.bind(this)
    this.tor.events.addEventListener("RELAY_CONNECTED", onRelayConnectedCell, { passive: true })

    const onRelayDataCell = this.#onRelayDataCell.bind(this)
    this.tor.events.addEventListener("RELAY_DATA", onRelayDataCell, { passive: true })

    const onRelayEndCell = this.#onRelayEndCell.bind(this)
    this.tor.events.addEventListener("RELAY_END", onRelayEndCell, { passive: true })
  }

  get closed() {
    return this.#closed
  }

  async #onTorClose(event: CloseEvent) {
    console.debug(`${this.#class.name}.onReadClose`, event)

    this.#closed = {}

    await this.events.dispatchEvent(event, "close")
  }

  async #onTorError(event: ErrorEvent) {
    console.debug(`${this.#class.name}.onReadError`, event)

    this.#closed = { reason: event.error }

    await this.events.dispatchEvent(event, "error")
  }

  async #onDestroyCell(event: MessageEvent<DestroyCell>) {
    if (event.data.circuit !== this) return

    console.debug(`${this.#class.name}.onDestroyCell`, event)

    this.#closed = {}

    const error = new Error(`Destroyed`, { cause: event.data })
    const errorEvent = new ErrorEvent("error", { error })
    await this.events.dispatchEvent(errorEvent, "error")
  }

  async #onRelayExtended2Cell(event: MessageEvent<RelayExtended2Cell<Opaque>>) {
    if (event.data.circuit !== this) return

    console.debug(`${this.#class.name}.onRelayExtended2Cell`, event)

    await this.events.dispatchEvent(event, "RELAY_EXTENDED2")
  }

  async #onRelayTruncatedCell(event: MessageEvent<RelayTruncatedCell>) {
    if (event.data.circuit !== this) return

    console.debug(`${this.#class.name}.onRelayTruncatedCell`, event)

    this.#closed = {}

    this.events.dispatchEvent(event, "RELAY_TRUNCATED")

    const error = new Error(`Errored`, { cause: event.data })
    const errorEvent = new ErrorEvent("error", { error })
    await this.events.dispatchEvent(errorEvent, "error")
  }

  async #onRelayConnectedCell(event: MessageEvent<RelayConnectedCell>) {
    if (event.data.circuit !== this) return

    console.debug(`${this.#class.name}.onRelayConnectedCell`, event)
  }

  async #onRelayDataCell(event: MessageEvent<RelayDataCell<Opaque>>) {
    if (event.data.circuit !== this) return

    console.debug(`${this.#class.name}.onRelayDataCell`, event)

    await this.events.dispatchEvent(event, "RELAY_DATA")
  }

  async #onRelayEndCell(event: MessageEvent<RelayEndCell>) {
    if (event.data.circuit !== this) return

    console.debug(`${this.#class.name}.onRelayEndCell`, event)

    await this.events.dispatchEvent(event, "RELAY_END")

    this.streams.delete(event.data.stream.id)
  }

  async extendDir() {
    const authority = Arrays.random(this.tor.authorities.filter(it => it.v3ident))

    if (!authority)
      throw new Error(`Could not find authority`)

    await this.extendTo({
      hosts: [authority.ipv4],
      id: authority.v3ident!,
      onion: authority.fingerprint,
    })
  }

  async tryExtend(exit: boolean, params: LoopParams = {}) {
    const { signal, timeout = 5000, delay = 1000 } = params

    while (!this.closed) {
      try {
        const signal = AbortSignal.timeout(timeout)
        return await this.extend(exit, signal)
      } catch (e: unknown) {
        if (this.closed) throw e
        if (signal?.aborted) throw e

        console.warn("Extend failed", e)
        await new Promise(ok => setTimeout(ok, delay))
      }
    }

    throw new Error(`Closed`, { cause: this.closed.reason })
  }

  async extend(exit: boolean, signal?: AbortSignal) {
    if (this.closed)
      throw new Error(`Circuit is closed`)

    const fallbacks = exit
      ? this.tor.params.fallbacks.filter(it => it.exit)
      : this.tor.params.fallbacks
    const fallback = Arrays.random(fallbacks)

    if (!fallback)
      throw new Error(`Could not find fallback`)

    return await this.extendTo(fallback, signal)
  }

  async extendTo(fallback: Fallback, signal?: AbortSignal) {
    if (this.closed)
      throw new Error(`Circuit is closed`)

    const relayid_rsa = Bytes.fromHex(fallback.id)

    const relayid_ed = fallback.eid
      ? Bytes.fromBase64(fallback.eid)
      : undefined

    const links: RelayExtend2Link[] = fallback.hosts.map(RelayExtend2Link.fromAddressString)
    links.push(new RelayExtend2LinkLegacyID(relayid_rsa))
    if (relayid_ed) links.push(new RelayExtend2LinkModernID(relayid_ed))

    const wasm_secret_x = new X25519StaticSecret()

    const public_x = wasm_secret_x.to_public().to_bytes()
    const public_b = new Uint8Array(fallback.onion)

    const ntor_request = new Ntor.Request(public_x, relayid_rsa, public_b)
    const relay_extend2 = new RelayExtend2Cell(this, undefined, RelayExtend2Cell.types.NTOR, links, ntor_request)
    this.tor.writer.enqueue(RelayEarlyCell.from(relay_extend2).cell())

    const msg_extended2 = await Events.wait(this.events, "RELAY_EXTENDED2", signal)
    const response = msg_extended2.data.data.into(Ntor.Response)
    const { public_y } = response

    const wasm_public_y = new X25519PublicKey(public_y)
    const wasm_public_b = new X25519PublicKey(public_b)

    const shared_xy = wasm_secret_x.diffie_hellman(wasm_public_y).to_bytes()
    const shared_xb = wasm_secret_x.diffie_hellman(wasm_public_b).to_bytes()

    const result = await Ntor.finalize(shared_xy, shared_xb, relayid_rsa, public_b, public_x, public_y)

    if (!Bytes.equals(response.auth, result.auth))
      throw new Error(`Invalid Ntor auth`)

    const forward_digest = new Sha1Hasher()
    const backward_digest = new Sha1Hasher()

    forward_digest.update(result.forwardDigest)
    backward_digest.update(result.backwardDigest)

    const forward_key = new Aes128Ctr128BEKey(result.forwardKey, Bytes.alloc(16))
    const backward_key = new Aes128Ctr128BEKey(result.backwardKey, Bytes.alloc(16))

    const target = new Target(relayid_rsa, this, forward_digest, backward_digest, forward_key, backward_key)

    this.targets.push(target)
  }

  async destroy() {
    this.#closed = {}

    const error = new Error(`Destroyed`)
    const errorEvent = new ErrorEvent("error", { error })
    await this.events.dispatchEvent(errorEvent, "error")
  }

  async truncate(reason = RelayTruncateCell.reasons.NONE) {
    const ptruncated = Events.wait(this.events, "RELAY_TRUNCATED")
    const relay_truncate = new RelayTruncateCell(this, undefined, reason)
    this.tor.writer.enqueue(RelayCell.from(relay_truncate).cell())
    await ptruncated
  }

  async open(hostname: string, port: number, signal?: AbortSignal) {
    if (this.closed)
      throw new Error(`Circuit is closed`)

    const streamId = this.#streamId++

    const stream = new TcpStream(streamId, this, signal)
    this.streams.set(streamId, stream)

    const flags = new Bitset(0, 32)
      .setLE(RelayBeginCell.flags.IPV4_OK, true)
      .setLE(RelayBeginCell.flags.IPV6_NOT_OK, false)
      .setLE(RelayBeginCell.flags.IPV6_PREFER, true)
      .unsign()
      .value
    const begin = new RelayBeginCell(this, stream, `${hostname}:${port}`, flags)
    this.tor.writer.enqueue(RelayCell.from(begin).cell())

    return stream
  }

  /**
   * Fetch using HTTP
   * @param input Fetch input
   * @param init Fetch init
   * @returns Response promise
   */
  async fetch(input: RequestInfo | URL, init: RequestInit = {}) {
    if (this.closed)
      throw new Error(`Circuit is closed`)

    const req = new Request(input, init)

    const url = new URL(req.url)

    if (url.protocol === "http:") {
      const port = Number(url.port) || 80
      const tcp = await this.open(url.hostname, port, req.signal)

      return fetch(input, { ...init, stream: tcp })
    }

    if (url.protocol === "https:") {
      const port = Number(url.port) || 443
      const tcp = await this.open(url.hostname, port, req.signal)

      const ciphers = [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384]
      const tls = new TlsClientDuplex(tcp, { ciphers })

      return fetch(input, { ...init, stream: tls })
    }

    throw new Error(`Unknown protocol ${url.protocol}`)
  }
}